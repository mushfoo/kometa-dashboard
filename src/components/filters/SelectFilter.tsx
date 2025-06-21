import React from 'react';

interface SelectFilterProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectFilter({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
}: SelectFilterProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-zinc-300 mb-1">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg
          text-white cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-700'}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        `}
      >
        <option value="" className="text-zinc-500">
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
