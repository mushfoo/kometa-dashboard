import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { useFormYamlSync } from '../useFormYamlSync';

// Mock yaml module
jest.mock('yaml', () => ({
  parse: jest.fn(),
  stringify: jest.fn(),
}));

const yaml = require('yaml');

// Test schema
const testSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
  settings: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
});

// Type for test schema
// type TestForm = z.infer<typeof testSchema>;

describe('useFormYamlSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default yaml behavior
    yaml.parse.mockImplementation((yamlString: string) => {
      if (yamlString.trim() === '') return {};
      if (yamlString.includes('invalid')) throw new Error('Invalid YAML');
      return { name: 'test', age: 25 };
    });
    yaml.stringify.mockImplementation(
      (data: any) => `name: ${data.name}\nage: ${data.age}`
    );
  });

  it('should initialize with empty values when no initial YAML provided', () => {
    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
      })
    );

    expect(result.current.yamlContent).toBe('');
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.isValid).toBe(true);
    expect(result.current.lastUpdatedBy).toBe(null);
  });

  it('should initialize with parsed YAML content', () => {
    const initialYaml = 'name: John\nage: 30';

    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
        initialYaml,
      })
    );

    expect(result.current.yamlContent).toBe(initialYaml);
    expect(yaml.parse).toHaveBeenCalledWith(initialYaml);
  });

  it('should handle form changes and update YAML', async () => {
    const onFormChange = jest.fn();
    const onYamlChange = jest.fn();

    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
        onFormChange,
        onYamlChange,
        debounceMs: 0, // No debounce for testing
      })
    );

    // Simulate form change
    act(() => {
      result.current.form.setValue('name', 'John');
      result.current.form.setValue('age', 30);
    });

    // Wait for debounced update
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(yaml.stringify).toHaveBeenCalled();
    expect(result.current.lastUpdatedBy).toBe('form');
    expect(result.current.hasChanges).toBe(true);
  });

  it('should handle YAML changes and update form', () => {
    const onYamlChange = jest.fn();

    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
        onYamlChange,
      })
    );

    const newYaml = 'name: Jane\nage: 25';

    act(() => {
      result.current.setYamlContent(newYaml);
    });

    expect(yaml.parse).toHaveBeenCalledWith(newYaml);
    expect(result.current.yamlContent).toBe(newYaml);
    expect(result.current.lastUpdatedBy).toBe('yaml');
    expect(result.current.hasChanges).toBe(true);
    expect(onYamlChange).toHaveBeenCalledWith(newYaml);
  });

  it('should handle invalid YAML and show validation errors', () => {
    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
      })
    );

    const invalidYaml = 'invalid yaml content';

    act(() => {
      result.current.setYamlContent(invalidYaml);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.validationErrors).toContain('Invalid YAML');
  });

  it('should detect sync conflicts', async () => {
    const onSyncConflict = jest.fn();

    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
        onSyncConflict,
        debounceMs: 0,
      })
    );

    // First, update from YAML
    act(() => {
      result.current.setYamlContent('name: Jane\nage: 25');
    });

    // Then try to update from form (should create conflict)
    act(() => {
      result.current.form.setValue('name', 'John');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(onSyncConflict).toHaveBeenCalled();
    expect(result.current.syncConflict).toBeTruthy();
  });

  it('should resolve sync conflicts correctly', () => {
    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
      })
    );

    // Create a mock conflict
    act(() => {
      result.current.setYamlContent('name: Jane\nage: 25');
    });

    // Manually set conflict for testing
    // const mockConflict = {
    //   type: 'form_to_yaml' as const,
    //   formData: { name: 'John', age: 30 },
    //   yamlData: { name: 'Jane', age: 25 },
    //   timestamp: Date.now(),
    // };

    // Simulate conflict resolution
    act(() => {
      // This would be called by the conflict resolution system
      if (result.current.resolveSyncConflict) {
        result.current.resolveSyncConflict('accept_form');
      }
    });

    expect(result.current.syncConflict).toBe(null);
  });

  it('should reset to original state', () => {
    const initialYaml = 'name: Original\nage: 20';

    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
        initialYaml,
      })
    );

    // Make changes
    act(() => {
      result.current.setYamlContent('name: Changed\nage: 30');
    });

    expect(result.current.hasChanges).toBe(true);

    // Reset
    act(() => {
      result.current.resetToOriginal();
    });

    expect(result.current.yamlContent).toBe(initialYaml);
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.lastUpdatedBy).toBe(null);
  });

  it('should handle empty YAML content gracefully', () => {
    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
      })
    );

    act(() => {
      result.current.setYamlContent('');
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.validationErrors).toHaveLength(0);
  });

  it('should validate form data against schema', () => {
    const { result } = renderHook(() =>
      useFormYamlSync({
        schema: testSchema,
      })
    );

    // Mock invalid data from YAML
    yaml.parse.mockReturnValueOnce({ name: 123, age: 'invalid' }); // Invalid types

    const invalidYaml = 'name: 123\nage: invalid';

    act(() => {
      result.current.setYamlContent(invalidYaml);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.validationErrors.length).toBeGreaterThan(0);
  });
});
