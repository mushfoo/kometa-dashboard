import React from 'react';
import { ComparisonOperator } from '@/types/filters';

interface DateFilterProps {
  label: string;
  value: string | [string, string];
  onChange: (value: string | [string, string]) => void;
  operator: ComparisonOperator;
  onOperatorChange: (operator: ComparisonOperator) => void;
  min?: string;
  max?: string;
}

export function DateFilter({
  label,
  value,
  onChange,
  operator,
  onOperatorChange,
  min,
  max,
}: DateFilterProps) {
  const handleSingleDateChange = (newDate: string) => {
    onChange(newDate);
  };

  const handleRangeDateChange = (index: 0 | 1, newDate: string) => {
    const currentRange = Array.isArray(value) ? value : ['', ''];
    const newRange: [string, string] = [...currentRange] as [string, string];
    newRange[index] = newDate;
    onChange(newRange);
  };

  const isBetween = operator === 'between';
  const dateValue = Array.isArray(value) ? value : [value || '', ''];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-zinc-300">{label}</label>
        <select
          value={operator}
          onChange={(e) =>
            onOperatorChange(e.target.value as ComparisonOperator)
          }
          className="text-xs px-2 py-1 bg-zinc-800 border border-zinc-700 rounded"
        >
          <option value="equals">On</option>
          <option value="greater_than">After</option>
          <option value="less_than">Before</option>
          <option value="between">Between</option>
        </select>
      </div>

      <div className="space-y-2">
        {isBetween ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">From</label>
              <input
                type="date"
                value={dateValue[0]}
                onChange={(e) => handleRangeDateChange(0, e.target.value)}
                min={min}
                max={max}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">To</label>
              <input
                type="date"
                value={dateValue[1]}
                onChange={(e) => handleRangeDateChange(1, e.target.value)}
                min={min}
                max={max}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ) : (
          <input
            type="date"
            value={Array.isArray(value) ? value[0] : value}
            onChange={(e) => handleSingleDateChange(e.target.value)}
            min={min}
            max={max}
            className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>
    </div>
  );
}
