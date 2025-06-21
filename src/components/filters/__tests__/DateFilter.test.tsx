import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateFilter } from '../DateFilter';
import { ComparisonOperator } from '@/types/filters';

describe('DateFilter', () => {
  const mockOnChange = jest.fn();
  const mockOnOperatorChange = jest.fn();

  const defaultProps = {
    label: 'Release Date',
    value: '',
    onChange: mockOnChange,
    operator: 'equals' as ComparisonOperator,
    onOperatorChange: mockOnOperatorChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with label and default operator', () => {
    render(<DateFilter {...defaultProps} />);

    expect(screen.getByText('Release Date')).toBeInTheDocument();
    expect(screen.getByDisplayValue('On')).toBeInTheDocument();
    expect(screen.getByDisplayValue('')).toBeInTheDocument();
  });

  it('handles operator changes', async () => {
    const user = userEvent.setup();
    render(<DateFilter {...defaultProps} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'greater_than');

    expect(mockOnOperatorChange).toHaveBeenCalledWith('greater_than');
  });

  it('handles single date value changes', async () => {
    const user = userEvent.setup();
    render(<DateFilter {...defaultProps} />);

    const input = screen.getByDisplayValue('');
    await user.click(input);
    await user.keyboard('2023-12-25');

    expect(mockOnChange).toHaveBeenCalledWith('2023-12-25');
  });

  it('shows range inputs when operator is between', () => {
    render(<DateFilter {...defaultProps} operator="between" />);

    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    const inputs = screen.getAllByDisplayValue('');
    expect(inputs).toHaveLength(2);
  });

  it('handles range date changes', async () => {
    const user = userEvent.setup();
    render(
      <DateFilter
        {...defaultProps}
        operator="between"
        value={['2023-01-01', '2023-12-31']}
      />
    );

    const fromInput = screen.getByDisplayValue('2023-01-01');
    const toInput = screen.getByDisplayValue('2023-12-31');

    expect(fromInput).toHaveValue('2023-01-01');
    expect(toInput).toHaveValue('2023-12-31');

    await user.clear(fromInput);
    await user.type(fromInput, '2023-06-01');

    expect(mockOnChange).toHaveBeenCalledWith(['2023-06-01', '2023-12-31']);
  });

  it('handles range date changes for "to" input', async () => {
    const user = userEvent.setup();
    render(
      <DateFilter
        {...defaultProps}
        operator="between"
        value={['2023-01-01', '2023-12-31']}
      />
    );

    const toInput = screen.getByDisplayValue('2023-12-31');

    await user.clear(toInput);
    await user.type(toInput, '2023-06-30');

    expect(mockOnChange).toHaveBeenCalledWith(['2023-01-01', '2023-06-30']);
  });

  it('handles array value with single date operator', async () => {
    const user = userEvent.setup();
    render(<DateFilter {...defaultProps} value={['2023-01-01', '']} />);

    const input = screen.getByDisplayValue('2023-01-01');
    expect(input).toHaveValue('2023-01-01');

    await user.clear(input);
    await user.type(input, '2023-12-25');

    expect(mockOnChange).toHaveBeenCalledWith('2023-12-25');
  });

  it('applies min and max constraints', () => {
    render(<DateFilter {...defaultProps} min="2020-01-01" max="2030-12-31" />);

    const input = screen.getByDisplayValue('');
    expect(input).toHaveAttribute('min', '2020-01-01');
    expect(input).toHaveAttribute('max', '2030-12-31');
  });

  it('applies min and max constraints to range inputs', () => {
    render(
      <DateFilter
        {...defaultProps}
        operator="between"
        min="2020-01-01"
        max="2030-12-31"
      />
    );

    const inputs = screen.getAllByDisplayValue('');
    inputs.forEach((input) => {
      expect(input).toHaveAttribute('min', '2020-01-01');
      expect(input).toHaveAttribute('max', '2030-12-31');
    });
  });

  it('handles empty range values correctly', async () => {
    const user = userEvent.setup();
    render(<DateFilter {...defaultProps} operator="between" value="" />);

    const inputs = screen.getAllByDisplayValue('');
    const fromInput = inputs[0]!;

    await user.type(fromInput, '2023-01-01');

    expect(mockOnChange).toHaveBeenCalledWith(['2023-01-01', '']);
  });

  it('displays all operator options', () => {
    render(<DateFilter {...defaultProps} />);

    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(4);
    expect(screen.getByRole('option', { name: 'On' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'After' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Before' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Between' })).toBeInTheDocument();
  });
});
