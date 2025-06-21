import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface MultiSelectFilterProps {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select options...',
  disabled = false,
  className = '',
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const selectedLabels = value.map(
    (v) => options.find((opt) => opt.value === v)?.label || v
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-zinc-300 mb-1">
        {label}
      </label>

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg
          flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-700 cursor-pointer'}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        `}
      >
        <div className="flex-1 text-left">
          {value.length === 0 ? (
            <span className="text-zinc-500">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.slice(0, 2).map((label, index) => (
                <span
                  key={value[index]}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-sm"
                >
                  {label}
                  {!disabled && (
                    <X
                      className="w-3 h-3 hover:text-blue-300 cursor-pointer"
                      onClick={(e) => removeOption(value[index] || '', e)}
                    />
                  )}
                </span>
              ))}
              {value.length > 2 && (
                <span className="text-sm text-zinc-400">
                  +{value.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-zinc-700">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-500">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className="w-full px-3 py-2 text-left hover:bg-zinc-700 flex items-center justify-between group"
                >
                  <span className="text-sm">{option.label}</span>
                  {value.includes(option.value) && (
                    <Check className="w-4 h-4 text-blue-400" />
                  )}
                </button>
              ))
            )}
          </div>

          {value.length > 0 && (
            <div className="p-2 border-t border-zinc-700">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full px-2 py-1 text-sm text-zinc-400 hover:text-white hover:bg-zinc-700 rounded"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
