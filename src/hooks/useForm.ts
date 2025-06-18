import {
  useForm as useReactHookForm,
  UseFormProps,
  UseFormReturn,
  FieldValues,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useCallback } from 'react';

interface UseFormOptions<T extends FieldValues> {
  schema?: z.ZodSchema<T>;
  persistKey?: string;
  defaultValues?: T;
  mode?: 'onChange' | 'onBlur' | 'onSubmit' | 'onTouched' | 'all';
}

interface UseFormWithPersistence<T extends FieldValues>
  extends UseFormReturn<T> {
  clearDraft: () => void;
  hasDraft: boolean;
}

const FORM_STORAGE_PREFIX = 'kometa-form-draft-';

/**
 * Enhanced useForm hook with validation, persistence, and error handling
 */
export function useForm<T extends FieldValues = FieldValues>(
  options: UseFormOptions<T> = {}
): UseFormWithPersistence<T> {
  const { schema, persistKey, defaultValues, mode = 'onChange' } = options;

  // Load persisted data if persistKey is provided
  const getPersistedData = useCallback((): Partial<T> | undefined => {
    if (!persistKey || typeof window === 'undefined') return undefined;

    try {
      const stored = localStorage.getItem(
        `${FORM_STORAGE_PREFIX}${persistKey}`
      );
      return stored ? JSON.parse(stored) : undefined;
    } catch (error) {
      console.warn('Failed to load form draft:', error);
      return undefined;
    }
  }, [persistKey]);

  const persistedData = getPersistedData();
  const hasDraft = Boolean(persistedData);

  // Merge persisted data with default values
  const initialValues = persistedData
    ? { ...defaultValues, ...persistedData }
    : defaultValues;

  const formProps: UseFormProps<T> = {
    // @ts-ignore - Temporary disable for complex defaultValues typing
    defaultValues: initialValues,
    mode,
    reValidateMode: 'onChange',
  };

  if (schema) {
    // @ts-ignore - Temporary disable for resolver typing complexity
    formProps.resolver = zodResolver(schema);
  }

  const form = useReactHookForm<T>(formProps);
  const { watch } = form;

  // Persist form data on changes
  useEffect(() => {
    if (!persistKey || typeof window === 'undefined') return;

    const subscription = watch((data) => {
      try {
        // Only persist if there's actual data to save
        const hasData =
          data &&
          Object.values(data as Record<string, unknown>).some(
            (value) => value !== undefined && value !== '' && value !== null
          );

        if (hasData) {
          localStorage.setItem(
            `${FORM_STORAGE_PREFIX}${persistKey}`,
            JSON.stringify(data)
          );
        }
      } catch (error) {
        console.warn('Failed to persist form draft:', error);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, persistKey]);

  // Clear draft function
  const clearDraft = useCallback(() => {
    if (!persistKey || typeof window === 'undefined') return;

    try {
      localStorage.removeItem(`${FORM_STORAGE_PREFIX}${persistKey}`);
    } catch (error) {
      console.warn('Failed to clear form draft:', error);
    }
  }, [persistKey]);

  return {
    ...form,
    clearDraft,
    hasDraft,
  };
}

/**
 * Helper function to create a form field error getter
 */
export function getFieldError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: string
): string | undefined {
  const error = form.formState.errors[fieldName];
  return error?.message as string | undefined;
}

/**
 * Helper function to check if a field has been touched
 */
export function isFieldTouched<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: string
): boolean {
  // @ts-ignore - Temporary disable for complex field access typing
  return Boolean(form.formState.touchedFields[fieldName]);
}

/**
 * Helper function to check if a field is dirty (has been modified)
 */
export function isFieldDirty<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: string
): boolean {
  // @ts-ignore - Temporary disable for complex field access typing
  return Boolean(form.formState.dirtyFields[fieldName]);
}
