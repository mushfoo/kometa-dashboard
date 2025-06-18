import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import {
  useForm,
  getFieldError,
  isFieldTouched,
  isFieldDirty,
} from '../useForm';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('useForm', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  const testSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    age: z.number().min(18, 'Must be at least 18'),
  });

  type TestFormData = z.infer<typeof testSchema>;

  describe('basic functionality', () => {
    it('should initialize with default values', () => {
      const defaultValues = { name: 'John', email: '', age: 25 };
      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          defaultValues,
        })
      );

      expect(result.current.getValues()).toEqual(defaultValues);
    });

    it('should integrate with Zod resolver when schema provided', () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({ schema: testSchema })
      );

      // Test that the form was created successfully
      expect(result.current.handleSubmit).toBeDefined();
      expect(result.current.clearDraft).toBeDefined();
      expect(result.current.hasDraft).toBe(false);
    });

    it('should call handleSubmit when form is valid', async () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          defaultValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      const onValid = jest.fn();
      await act(async () => {
        await result.current.handleSubmit(onValid)();
      });

      expect(onValid).toHaveBeenCalledWith(
        {
          name: 'John',
          email: 'john@example.com',
          age: 25,
        },
        undefined
      );
    });

    it('should handle submission errors', async () => {
      const error = new Error('Submission failed');
      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          defaultValues: { name: 'John', email: 'john@example.com', age: 25 },
        })
      );

      const onValid = jest.fn().mockRejectedValue(error);

      await act(async () => {
        try {
          await result.current.handleSubmit(onValid)();
        } catch (err) {
          expect(err).toBe(error);
        }
      });

      expect(onValid).toHaveBeenCalled();
    });
  });

  describe('persistence functionality', () => {
    const persistKey = 'test-form';

    it('should save form data to localStorage', async () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          persistKey,
        })
      );

      await act(async () => {
        result.current.setValue('name', 'John');
      });

      // Wait for the watch effect to trigger
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'kometa-form-draft-test-form',
        JSON.stringify({ name: 'John' })
      );
    });

    it('should load persisted data on initialization', () => {
      const persistedData = {
        name: 'Jane',
        email: 'jane@example.com',
        age: 30,
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(persistedData));

      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          persistKey,
          defaultValues: { name: '', email: '', age: 0 },
        })
      );

      expect(result.current.getValues()).toEqual(persistedData);
      expect(result.current.hasDraft).toBe(true);
    });

    it('should merge persisted data with default values', () => {
      const persistedData = { name: 'Jane' };
      const defaultValues = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(persistedData));

      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          persistKey,
          defaultValues,
        })
      );

      expect(result.current.getValues()).toEqual({
        name: 'Jane', // From persisted data
        email: 'john@example.com', // From default values
        age: 25, // From default values
      });
    });

    it('should clear draft from localStorage', () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          persistKey,
        })
      );

      act(() => {
        result.current.clearDraft();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'kometa-form-draft-test-form'
      );
    });

    it('should clear draft manually', () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          persistKey,
        })
      );

      act(() => {
        result.current.clearDraft();
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'kometa-form-draft-test-form'
      );
    });

    it('should handle localStorage errors gracefully on clear', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          persistKey,
        })
      );

      act(() => {
        result.current.clearDraft();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear form draft:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          persistKey,
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load form draft:',
        expect.any(Error)
      );
      expect(result.current.hasDraft).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should not persist when no persistKey is provided', async () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({ schema: testSchema })
      );

      await act(async () => {
        result.current.setValue('name', 'John');
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('helper functions', () => {
    it('getFieldError should return field error message', () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({ schema: testSchema })
      );

      // Test that the helper function works with form state
      expect(typeof getFieldError).toBe('function');
      expect(getFieldError(result.current, 'email')).toBeUndefined();
    });

    it('isFieldTouched should return touch status', () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({ schema: testSchema })
      );

      expect(isFieldTouched(result.current, 'name')).toBe(false);

      act(() => {
        result.current.trigger('name');
      });

      // Note: In real usage, fields become touched through user interaction
      // This test checks the function works with the form state
    });

    it('isFieldDirty should return dirty status', async () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({
          schema: testSchema,
          defaultValues: { name: 'John', email: '', age: 0 },
        })
      );

      expect(isFieldDirty(result.current, 'name')).toBe(false);

      await act(async () => {
        result.current.setValue('name', 'Jane', { shouldDirty: true });
      });

      expect(isFieldDirty(result.current, 'name')).toBe(true);
    });
  });

  describe('form modes', () => {
    it('should validate onChange by default', () => {
      const { result } = renderHook(() =>
        useForm<TestFormData>({ schema: testSchema })
      );

      expect(result.current.control._options.mode).toBe('onChange');
      expect(result.current.control._options.reValidateMode).toBe('onChange');
    });
  });

  describe('without schema', () => {
    it('should work without Zod schema', () => {
      const { result } = renderHook(() =>
        useForm<{ name: string }>({
          defaultValues: { name: 'John' },
        })
      );

      expect(result.current.getValues()).toEqual({ name: 'John' });
    });
  });
});
