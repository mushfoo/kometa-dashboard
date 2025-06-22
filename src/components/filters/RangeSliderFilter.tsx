import React, { useState, useEffect } from 'react';

interface RangeSliderFilterProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number | [number, number];
  onChange: (value: number | [number, number]) => void;
  operator: 'equals' | 'greater_than' | 'less_than' | 'between';
  onOperatorChange: (
    operator: 'equals' | 'greater_than' | 'less_than' | 'between'
  ) => void;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

export function RangeSliderFilter({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  operator,
  onOperatorChange,
  formatValue = (v) => v.toString(),
  disabled = false,
  className = '',
}: RangeSliderFilterProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleOperatorChange = (newOperator: typeof operator) => {
    onOperatorChange(newOperator);

    // Convert value when switching between single and range
    if (newOperator === 'between' && typeof localValue === 'number') {
      onChange([localValue, max]);
    } else if (newOperator !== 'between' && Array.isArray(localValue)) {
      onChange(localValue[0]);
    }
  };

  const handleSingleChange = (newValue: number) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleRangeChange = (index: 0 | 1, newValue: number) => {
    if (Array.isArray(localValue)) {
      const newRange: [number, number] = [...localValue];
      newRange[index] = newValue;

      // Ensure min <= max
      if (index === 0 && newValue > localValue[1]) {
        newRange[1] = newValue;
      } else if (index === 1 && newValue < localValue[0]) {
        newRange[0] = newValue;
      }

      setLocalValue(newRange);
      onChange(newRange);
    }
  };

  const percentage = (val: number) => ((val - min) / (max - min)) * 100;

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
          {label}
        </label>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => handleOperatorChange('equals')}
            disabled={disabled}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              operator === 'equals'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-zinc-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Equals
          </button>
          <button
            type="button"
            onClick={() => handleOperatorChange('greater_than')}
            disabled={disabled}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              operator === 'greater_than'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-zinc-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Greater than
          </button>
          <button
            type="button"
            onClick={() => handleOperatorChange('less_than')}
            disabled={disabled}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              operator === 'less_than'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-zinc-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Less than
          </button>
          <button
            type="button"
            onClick={() => handleOperatorChange('between')}
            disabled={disabled}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              operator === 'between'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-zinc-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Between
          </button>
        </div>
      </div>

      {operator === 'between' && Array.isArray(localValue) ? (
        <div className="space-y-4">
          <div className="relative pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-zinc-400">
                From: {formatValue(localValue[0])}
              </span>
              <span className="text-sm text-gray-600 dark:text-zinc-400">
                To: {formatValue(localValue[1])}
              </span>
            </div>

            <div className="relative h-2">
              <div className="absolute w-full h-2 bg-gray-300 dark:bg-zinc-700 rounded-full" />
              <div
                className="absolute h-2 bg-blue-500 rounded-full"
                style={{
                  left: `${percentage(localValue[0])}%`,
                  width: `${percentage(localValue[1]) - percentage(localValue[0])}%`,
                }}
              />

              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={localValue[0]}
                onChange={(e) => handleRangeChange(0, Number(e.target.value))}
                disabled={disabled}
                className="absolute w-full h-2 appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed"
                style={{ pointerEvents: disabled ? 'none' : 'auto' }}
              />

              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={localValue[1]}
                onChange={(e) => handleRangeChange(1, Number(e.target.value))}
                disabled={disabled}
                className="absolute w-full h-2 appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed"
                style={{ pointerEvents: disabled ? 'none' : 'auto' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={min}
              max={localValue[1]}
              step={step}
              value={localValue[0]}
              onChange={(e) => handleRangeChange(0, Number(e.target.value))}
              disabled={disabled}
              className="px-3 py-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <input
              type="number"
              min={localValue[0]}
              max={max}
              step={step}
              value={localValue[1]}
              onChange={(e) => handleRangeChange(1, Number(e.target.value))}
              disabled={disabled}
              className="px-3 py-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              {formatValue(localValue as number)}
            </span>
          </div>

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={localValue as number}
            onChange={(e) => handleSingleChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-300 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
          />

          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={localValue as number}
            onChange={(e) => handleSingleChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full px-3 py-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}
