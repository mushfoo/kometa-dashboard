import React from 'react';
import { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { z } from 'zod';
import { FormInput } from './FormInput';
import { FormSelect } from './FormSelect';
import { FormCheckbox } from './FormCheckbox';
import { FormTextarea } from './FormTextarea';

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface FieldConfig {
  type?:
    | 'input'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'number'
    | 'email'
    | 'url'
    | 'password';
  label?: string;
  placeholder?: string;
  helpText?: string;
  options?: SelectOption[];
  rows?: number;
  maxLength?: number;
  searchable?: boolean;
  section?: string;
  order?: number;
  conditional?: {
    field: string;
    value: any;
    operator?: 'equals' | 'not-equals' | 'includes' | 'not-includes';
  };
}

interface SectionConfig {
  title: string;
  description?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

interface DynamicFormProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  schema: z.ZodSchema<T>;
  fieldConfigs?: Record<string, FieldConfig>;
  sectionConfigs?: Record<string, SectionConfig>;
  className?: string;
}

interface FieldTypeInference {
  type:
    | 'input'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'number'
    | 'email'
    | 'url'
    | 'password';
  inputType?: string;
}

function inferFieldType(zodType: any, fieldName: string): FieldTypeInference {
  // Handle ZodOptional and ZodNullable
  if (zodType._def?.innerType) {
    return inferFieldType(zodType._def.innerType, fieldName);
  }

  // Handle ZodDefault
  if (zodType._def?.defaultValue !== undefined) {
    return inferFieldType(zodType._def.innerType || zodType, fieldName);
  }

  const typeName = zodType._def?.typeName || zodType.constructor?.name;

  switch (typeName) {
    case 'ZodString':
      // Check for URL validation
      if (zodType._def?.checks?.some((check: any) => check.kind === 'url')) {
        return { type: 'input', inputType: 'url' };
      }
      // Check for email validation
      if (zodType._def?.checks?.some((check: any) => check.kind === 'email')) {
        return { type: 'input', inputType: 'email' };
      }
      // Check for multiline fields or length > 100
      if (
        fieldName.toLowerCase().includes('description') ||
        fieldName.toLowerCase().includes('comment') ||
        fieldName.toLowerCase().includes('notes') ||
        zodType._def?.checks?.some(
          (check: any) => check.kind === 'max' && check.value > 100
        )
      ) {
        return { type: 'textarea' };
      }
      // Check for password fields
      if (
        fieldName.toLowerCase().includes('password') ||
        fieldName.toLowerCase().includes('token') ||
        fieldName.toLowerCase().includes('key')
      ) {
        return { type: 'input', inputType: 'password' };
      }
      return { type: 'input', inputType: 'text' };

    case 'ZodNumber':
      return { type: 'input', inputType: 'number' };

    case 'ZodBoolean':
      return { type: 'checkbox' };

    case 'ZodEnum':
      return { type: 'select' };

    case 'ZodUnion':
      // For unions, try to infer from the first type
      const firstType = zodType._def?.options?.[0];
      if (firstType) {
        return inferFieldType(firstType, fieldName);
      }
      return { type: 'input', inputType: 'text' };

    case 'ZodObject':
      // For nested objects, treat as a group (not implemented in this basic version)
      return { type: 'input', inputType: 'text' };

    default:
      return { type: 'input', inputType: 'text' };
  }
}

function getEnumOptions(zodType: any): SelectOption[] {
  if (zodType._def?.typeName === 'ZodEnum') {
    return zodType._def.values.map((value: string) => ({
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
    }));
  }

  if (zodType._def?.typeName === 'ZodUnion') {
    const enumType = zodType._def.options.find(
      (option: any) => option._def?.typeName === 'ZodEnum'
    );
    if (enumType) {
      return getEnumOptions(enumType);
    }
  }

  return [];
}

function shouldShowField<T extends FieldValues>(
  fieldName: string,
  fieldConfig: FieldConfig | undefined,
  formValues: T
): boolean {
  if (!fieldConfig?.conditional) return true;

  const { field, value, operator = 'equals' } = fieldConfig.conditional;
  const fieldValue = formValues[field as keyof T];

  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'not-equals':
      return fieldValue !== value;
    case 'includes':
      return Array.isArray(fieldValue) && fieldValue.includes(value);
    case 'not-includes':
      return Array.isArray(fieldValue) && !fieldValue.includes(value);
    default:
      return true;
  }
}

export function DynamicForm<T extends FieldValues>({
  form,
  schema,
  fieldConfigs = {},
  sectionConfigs = {},
  className = '',
}: DynamicFormProps<T>) {
  const { watch } = form;
  const formValues = watch();

  // Extract field definitions from schema
  const getSchemaFields = (zodSchema: z.ZodSchema): Record<string, any> => {
    // For ZodObject, the shape is accessible via the shape property
    if ((zodSchema as any).shape) {
      return (zodSchema as any).shape;
    }

    // Try _def.shape as a function (newer Zod versions)
    if (zodSchema._def?.shape && typeof zodSchema._def.shape === 'function') {
      return zodSchema._def.shape();
    }

    // Try _def.shape as an object (older Zod versions)
    if (zodSchema._def?.shape && typeof zodSchema._def.shape === 'object') {
      return zodSchema._def.shape;
    }

    return {};
  };

  const schemaFields = getSchemaFields(schema);
  const fieldNames = Object.keys(schemaFields);

  // Group fields by section
  const fieldsBySection = fieldNames.reduce(
    (acc, fieldName) => {
      const config = fieldConfigs[fieldName];
      const section = config?.section || 'default';

      if (!acc[section]) {
        acc[section] = [];
      }

      acc[section].push({
        name: fieldName,
        config,
        zodType: schemaFields[fieldName],
        order: config?.order || 0,
      });

      return acc;
    },
    {} as Record<
      string,
      Array<{ name: string; config?: FieldConfig; zodType: any; order: number }>
    >
  );

  // Sort fields within each section
  Object.keys(fieldsBySection).forEach((section) => {
    fieldsBySection[section].sort((a, b) => a.order - b.order);
  });

  const renderField = (
    fieldName: string,
    zodType: any,
    config?: FieldConfig
  ) => {
    if (!shouldShowField(fieldName, config, formValues)) {
      return null;
    }

    const inferred = inferFieldType(zodType, fieldName);
    const fieldType = config?.type || inferred.type;
    const inputType = inferred.inputType;

    const commonProps = {
      form,
      name: fieldName as Path<T>,
      label:
        config?.label ||
        fieldName.charAt(0).toUpperCase() +
          fieldName.slice(1).replace(/([A-Z])/g, ' $1'),
      placeholder: config?.placeholder,
      helpText: config?.helpText,
      disabled: false,
      required:
        !zodType.isOptional?.() && zodType._def?.defaultValue === undefined,
    };

    switch (fieldType) {
      case 'select':
        const options = config?.options || getEnumOptions(zodType);
        return (
          <FormSelect
            {...commonProps}
            options={options}
            searchable={config?.searchable ?? true}
          />
        );

      case 'checkbox':
        return <FormCheckbox {...commonProps} />;

      case 'textarea':
        return (
          <FormTextarea
            {...commonProps}
            rows={config?.rows || 3}
            maxLength={config?.maxLength}
          />
        );

      case 'input':
      case 'number':
      case 'email':
      case 'url':
      case 'password':
      default:
        return (
          <FormInput {...commonProps} type={(inputType as any) || 'text'} />
        );
    }
  };

  const RenderSection = ({
    sectionName,
    fields,
  }: {
    sectionName: string;
    fields: Array<{ name: string; config?: FieldConfig; zodType: any }>;
  }) => {
    const sectionConfig = sectionConfigs[sectionName];
    const [isExpanded, setIsExpanded] = React.useState(
      sectionConfig?.defaultExpanded !== false
    );

    const sectionContent = (
      <div className="space-y-4">
        {fields.map(({ name, zodType, config }) => (
          <div key={name}>{renderField(name, zodType, config)}</div>
        ))}
      </div>
    );

    if (sectionName === 'default') {
      return sectionContent;
    }

    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <div
          className={`flex items-center justify-between ${
            sectionConfig?.collapsible ? 'cursor-pointer' : ''
          }`}
          onClick={() =>
            sectionConfig?.collapsible && setIsExpanded(!isExpanded)
          }
        >
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {sectionConfig?.title || sectionName}
            </h3>
            {sectionConfig?.description && (
              <p className="text-sm text-gray-500 mt-1">
                {sectionConfig.description}
              </p>
            )}
          </div>
          {sectionConfig?.collapsible && (
            <svg
              className={`w-5 h-5 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
        {isExpanded && <div className="mt-4">{sectionContent}</div>}
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {Object.entries(fieldsBySection).map(([sectionName, fields]) => (
        <div key={sectionName}>
          <RenderSection sectionName={sectionName} fields={fields} />
        </div>
      ))}
    </div>
  );
}
