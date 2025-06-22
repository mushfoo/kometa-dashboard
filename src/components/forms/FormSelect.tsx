import React, { useState, useRef, useEffect } from 'react';
import { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { getFieldError, isFieldTouched } from '../../hooks/useForm';

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface FormSelectProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label?: string;
  placeholder?: string;
  helpText?: string;
  options: SelectOption[];
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  className?: string;
}

export function FormSelect<T extends FieldValues>({
  form,
  name,
  label,
  placeholder = 'Select an option...',
  helpText,
  options,
  disabled = false,
  required = false,
  searchable = true,
  className = '',
}: FormSelectProps<T>) {
  const { register, setValue, watch } = form;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const error = getFieldError(form, name);
  const isTouched = isFieldTouched(form, name);
  const hasError = Boolean(error && isTouched);
  const currentValue = watch(name);

  const filteredOptions =
    searchable && searchTerm
      ? options.filter((option) =>
          option.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : options;

  const selectedOption = options.find(
    (option) => option.value === currentValue
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (option: SelectOption) => {
    setValue(name, option.value as any, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setIsOpen(false);
    setSearchTerm('');
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setSearchTerm('');
    }
  };

  const selectClasses = `
    relative w-full cursor-pointer border rounded-md shadow-sm transition-colors
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
    disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed
    ${
      hasError
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800'
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
      {/* Hidden input for form registration */}
      <input {...register(name)} type="hidden" value={currentValue || ''} />

      {label && (
        <label id={`${name}-label`} className={labelClasses}>
          {label}
        </label>
      )}

      <div className="relative" ref={dropdownRef}>
        <div
          id={name}
          className={selectClasses}
          onClick={toggleDropdown}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={label ? `${name}-label` : undefined}
          aria-describedby={
            helpText || error
              ? `${name}-description${error ? ` ${name}-error` : ''}`.trim()
              : undefined
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDropdown();
            }
          }}
        >
          <div className="px-3 py-2 flex items-center justify-between">
            <span
              className={
                selectedOption
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-400 dark:text-gray-500'
              }
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''} ${hasError ? 'text-red-500' : 'text-gray-400'}`}
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
          </div>
        </div>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
            {searchable && (
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}

            <div role="listbox">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`
                      px-3 py-2 cursor-pointer text-sm transition-colors
                      ${
                        option.disabled
                          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : currentValue === option.value
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `
                      .trim()
                      .replace(/\s+/g, ' ')}
                    onClick={() => !option.disabled && handleSelect(option)}
                    role="option"
                    aria-selected={currentValue === option.value}
                  >
                    {option.label}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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
  );
}
