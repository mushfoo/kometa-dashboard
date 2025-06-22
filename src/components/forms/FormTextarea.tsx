import React from 'react';
import { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { getFieldError, isFieldTouched } from '../../hooks/useForm';

interface FormTextareaProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label?: string;
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
}

export function FormTextarea<T extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  helpText,
  disabled = false,
  required = false,
  rows = 3,
  maxLength,
  className = '',
}: FormTextareaProps<T>) {
  const { register, watch } = form;
  const error = getFieldError(form, name);
  const isTouched = isFieldTouched(form, name);
  const hasError = Boolean(error && isTouched);
  const currentValue = watch(name) || '';
  const characterCount = String(currentValue).length;

  const textareaClasses = `
    w-full px-3 py-2 border rounded-md shadow-sm transition-colors resize-vertical
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
    disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed
    ${
      hasError
        ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800'
    }
    ${className}
  `
    .trim()
    .replace(/\s+/g, ' ');

  const labelClasses = `
    block text-sm font-medium mb-1
    ${hasError ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}
    ${required ? "after:content-['*'] after:text-red-500 after:ml-1" : ''}
  `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={name} className={labelClasses}>
          {label}
        </label>
      )}

      <textarea
        {...register(name)}
        id={name}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={textareaClasses}
        aria-invalid={hasError}
        aria-describedby={
          helpText || error || maxLength
            ? `${name}-description${error ? ` ${name}-error` : ''}${maxLength ? ` ${name}-count` : ''}`.trim()
            : undefined
        }
      />

      <div className="flex justify-between items-start">
        <div className="flex-1">
          {helpText && !hasError && (
            <p
              id={`${name}-description`}
              className="text-sm text-gray-500 dark:text-gray-400"
            >
              {helpText}
            </p>
          )}

          {hasError && (
            <p
              id={`${name}-error`}
              className="text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}
        </div>

        {maxLength && (
          <p
            id={`${name}-count`}
            className={`text-xs ml-4 ${
              characterCount > maxLength * 0.9
                ? characterCount >= maxLength
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-yellow-600 dark:text-yellow-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {characterCount}
            {maxLength && `/${maxLength}`}
          </p>
        )}
      </div>
    </div>
  );
}
