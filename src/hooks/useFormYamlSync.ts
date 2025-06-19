import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import yaml from 'yaml';

interface FormYamlSyncOptions<T extends Record<string, any>> {
  schema: z.ZodSchema<T>;
  initialYaml?: string;
  // eslint-disable-next-line no-unused-vars
  onFormChange?: (data: T) => void;
  // eslint-disable-next-line no-unused-vars
  onYamlChange?: (yamlContent: string) => void;
  // eslint-disable-next-line no-unused-vars
  onSyncConflict?: (conflictData: SyncConflict<T>) => void;
  debounceMs?: number;
}

interface SyncConflict<T> {
  type: 'form_to_yaml' | 'yaml_to_form';
  formData: T;
  yamlData: any;
  timestamp: number;
}

interface UseFormYamlSyncReturn<T extends Record<string, any>> {
  form: UseFormReturn<T>;
  yamlContent: string;
  // eslint-disable-next-line no-unused-vars
  setYamlContent: (yamlContent: string) => void;
  isValid: boolean;
  validationErrors: string[];
  hasChanges: boolean;
  lastUpdatedBy: 'form' | 'yaml' | null;
  syncConflict: SyncConflict<T> | null;
  resolveSyncConflict: (
    // eslint-disable-next-line no-unused-vars
    resolutionType: 'accept_form' | 'accept_yaml' | 'merge'
  ) => void;
  resetToOriginal: () => void;
}

/**
 * Hook for bidirectional synchronization between React Hook Form and YAML editor
 * Handles form-to-YAML and YAML-to-form conversion with conflict resolution
 */
export function useFormYamlSync<T extends Record<string, any>>({
  schema,
  initialYaml = '',
  onFormChange,
  onYamlChange,
  onSyncConflict,
  debounceMs = 500,
}: FormYamlSyncOptions<T>): UseFormYamlSyncReturn<T> {
  const [yamlContent, setYamlContentInternal] = useState(initialYaml);
  const [isValid, setIsValid] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<'form' | 'yaml' | null>(
    null
  );
  const [syncConflict, setSyncConflict] = useState<SyncConflict<T> | null>(
    null
  );

  const originalYaml = useRef(initialYaml);
  const isUpdatingFromSync = useRef(false);
  const debounceTimeout = useRef<NodeJS.Timeout>();

  // Parse initial YAML to get default form values
  const getDefaultValues = useCallback((): Partial<T> => {
    if (!initialYaml.trim()) return {};

    try {
      const parsed = yaml.parse(initialYaml);
      return parsed || {};
    } catch (error) {
      console.warn('Failed to parse initial YAML for form defaults:', error);
      return {};
    }
  }, [initialYaml]);

  const form = useForm<T>({
    resolver: zodResolver(schema as any),
    defaultValues: getDefaultValues() as any,
    mode: 'onChange',
  });

  // Convert form data to YAML
  const formToYaml = useCallback(
    (formData: T): string => {
      try {
        return yaml.stringify(formData, {
          indent: 2,
          lineWidth: 120,
          minContentWidth: 80,
        });
      } catch (error) {
        console.error('Failed to convert form to YAML:', error);
        return yamlContent;
      }
    },
    [yamlContent]
  );

  // Parse YAML and update form
  const yamlToForm = useCallback(
    (yamlString: string): { success: boolean; data?: T; errors?: string[] } => {
      if (!yamlString.trim()) {
        return { success: true, data: {} as T };
      }

      try {
        const parsed = yaml.parse(yamlString);
        const result = schema.safeParse(parsed);

        if (result.success) {
          return { success: true, data: result.data };
        } else {
          const errors = result.error.errors.map(
            (err) => `${err.path.join('.')}: ${err.message}`
          );
          return { success: false, errors };
        }
      } catch (yamlError) {
        const error =
          yamlError instanceof Error ? yamlError.message : 'Invalid YAML';
        return { success: false, errors: [error] };
      }
    },
    [schema]
  );

  // Debounced form change handler
  const handleFormChange = useCallback(
    (formData: T) => {
      if (isUpdatingFromSync.current) return;

      // Clear existing timeout
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }

      debounceTimeout.current = setTimeout(() => {
        // Check for conflicts
        if (lastUpdatedBy === 'yaml' && hasChanges) {
          const conflict: SyncConflict<T> = {
            type: 'form_to_yaml',
            formData,
            yamlData: yaml.parse(yamlContent),
            timestamp: Date.now(),
          };
          setSyncConflict(conflict);
          onSyncConflict?.(conflict);
          return;
        }

        const newYaml = formToYaml(formData);
        setYamlContentInternal(newYaml);
        setLastUpdatedBy('form');
        setHasChanges(true);
        setIsValid(true);
        setValidationErrors([]);
        onFormChange?.(formData);
        onYamlChange?.(newYaml);
      }, debounceMs);
    },
    [
      formToYaml,
      lastUpdatedBy,
      hasChanges,
      yamlContent,
      onFormChange,
      onYamlChange,
      onSyncConflict,
      debounceMs,
    ]
  );

  // Handle YAML content changes
  const setYamlContent = useCallback(
    (newYaml: string) => {
      if (isUpdatingFromSync.current) return;

      setYamlContentInternal(newYaml);

      const parseResult = yamlToForm(newYaml);

      if (parseResult.success && parseResult.data) {
        setIsValid(true);
        setValidationErrors([]);

        // Check for conflicts
        const currentFormData = form.getValues();
        const hasFormChanges =
          JSON.stringify(currentFormData) !== JSON.stringify(parseResult.data);

        if (lastUpdatedBy === 'form' && hasFormChanges && hasChanges) {
          const conflict: SyncConflict<T> = {
            type: 'yaml_to_form',
            formData: currentFormData,
            yamlData: parseResult.data,
            timestamp: Date.now(),
          };
          setSyncConflict(conflict);
          onSyncConflict?.(conflict);
          return;
        }

        // Update form with parsed data
        isUpdatingFromSync.current = true;
        form.reset(parseResult.data);
        isUpdatingFromSync.current = false;

        setLastUpdatedBy('yaml');
        setHasChanges(true);
        onYamlChange?.(newYaml);
      } else {
        setIsValid(false);
        setValidationErrors(parseResult.errors || ['Invalid YAML']);
      }
    },
    [yamlToForm, form, lastUpdatedBy, hasChanges, onYamlChange, onSyncConflict]
  );

  // Resolve sync conflicts
  const resolveSyncConflict = useCallback(
    (resolutionType: 'accept_form' | 'accept_yaml' | 'merge') => {
      if (!syncConflict) return;

      isUpdatingFromSync.current = true;

      try {
        switch (resolutionType) {
          case 'accept_form':
            if (syncConflict.type === 'form_to_yaml') {
              const newYaml = formToYaml(syncConflict.formData);
              setYamlContentInternal(newYaml);
              setLastUpdatedBy('form');
              onYamlChange?.(newYaml);
            } else {
              // Keep current form data, update YAML
              const currentFormData = form.getValues();
              const newYaml = formToYaml(currentFormData);
              setYamlContentInternal(newYaml);
              setLastUpdatedBy('form');
              onYamlChange?.(newYaml);
            }
            break;

          case 'accept_yaml':
            if (syncConflict.type === 'yaml_to_form') {
              form.reset(syncConflict.yamlData);
              setLastUpdatedBy('yaml');
            } else {
              // Parse current YAML and update form
              const parseResult = yamlToForm(yamlContent);
              if (parseResult.success && parseResult.data) {
                form.reset(parseResult.data);
                setLastUpdatedBy('yaml');
              }
            }
            break;

          case 'merge':
            // Simple merge strategy: combine non-empty fields
            const merged = {
              ...syncConflict.yamlData,
              ...syncConflict.formData,
            };
            const mergedYaml = formToYaml(merged as T);
            form.reset(merged);
            setYamlContentInternal(mergedYaml);
            setLastUpdatedBy('form');
            onYamlChange?.(mergedYaml);
            break;
        }

        setIsValid(true);
        setValidationErrors([]);
        setSyncConflict(null);
      } finally {
        isUpdatingFromSync.current = false;
      }
    },
    [syncConflict, formToYaml, form, yamlToForm, yamlContent, onYamlChange]
  );

  // Reset to original state
  const resetToOriginal = useCallback(() => {
    isUpdatingFromSync.current = true;

    try {
      setYamlContentInternal(originalYaml.current);
      const parseResult = yamlToForm(originalYaml.current);

      if (parseResult.success && parseResult.data) {
        form.reset(parseResult.data);
      } else {
        form.reset({} as T);
      }

      setHasChanges(false);
      setLastUpdatedBy(null);
      setSyncConflict(null);
      setIsValid(true);
      setValidationErrors([]);
    } finally {
      isUpdatingFromSync.current = false;
    }
  }, [yamlToForm, form]);

  // Watch form changes
  useEffect(() => {
    const subscription = form.watch((data) => {
      if (!isUpdatingFromSync.current) {
        handleFormChange(data as T);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, handleFormChange]);

  // Update original YAML when initialYaml changes
  useEffect(() => {
    originalYaml.current = initialYaml;
    if (!hasChanges) {
      setYamlContentInternal(initialYaml);
    }
  }, [initialYaml, hasChanges]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return {
    form,
    yamlContent,
    setYamlContent,
    isValid,
    validationErrors,
    hasChanges,
    lastUpdatedBy,
    syncConflict,
    resolveSyncConflict,
    resetToOriginal,
  };
}
