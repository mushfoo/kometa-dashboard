import React from 'react';
import { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { getFieldError, isFieldTouched } from '../../hooks/useForm';

interface FormCheckboxProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label?: string;
  helpText?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function FormCheckbox<T extends FieldValues>({
  form,
  name,
  label,
  helpText,
  disabled = false,
  required = false,
  className = '',
}: FormCheckboxProps<T>) {
  const { register } = form;
  const error = getFieldError(form, name);
  const isTouched = isFieldTouched(form, name);
  const hasError = Boolean(error && isTouched);

  const checkboxClasses = `
    h-4 w-4 rounded border-gray-300 transition-colors
    focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
    disabled:cursor-not-allowed disabled:opacity-50
    ${
      hasError
        ? 'text-red-600 border-red-300 focus:border-red-500 focus:ring-red-500'
        : 'text-blue-600 focus:border-blue-500'
    }
  `
    .trim()
    .replace(/\s+/g, ' ');

  const labelClasses = `
    ml-2 text-sm font-medium cursor-pointer
    ${hasError ? 'text-red-700' : 'text-gray-700'}
    ${disabled ? 'cursor-not-allowed opacity-50' : ''}
    ${required ? "after:content-['*'] after:text-red-500 after:ml-1" : ''}
  `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-start">
        <input
          {...register(name)}
          id={name}
          type="checkbox"
          disabled={disabled}
          className={checkboxClasses}
          aria-invalid={hasError}
          aria-describedby={
            helpText || error
              ? `${name}-description ${error ? `${name}-error` : ''}`
              : undefined
          }
        />

        {label && (
          <label htmlFor={name} className={labelClasses}>
            {label}
          </label>
        )}
      </div>

      {helpText && !hasError && (
        <p id={`${name}-description`} className="text-sm text-gray-500 ml-6">
          {helpText}
        </p>
      )}

      {hasError && (
        <p id={`${name}-error`} className="text-sm text-red-600 ml-6">
          {error}
        </p>
      )}
    </div>
  );
}
