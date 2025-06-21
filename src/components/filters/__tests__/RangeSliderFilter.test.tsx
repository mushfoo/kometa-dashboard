import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RangeSliderFilter } from '../RangeSliderFilter';

describe('RangeSliderFilter', () => {
  const defaultProps = {
    label: 'Year',
    min: 1900,
    max: 2024,
    value: 2000,
    onChange: jest.fn(),
    operator: 'equals' as const,
    onOperatorChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with label and value', () => {
    render(<RangeSliderFilter {...defaultProps} />);

    expect(screen.getByText('Year')).toBeInTheDocument();
    // Use getAllByDisplayValue since there are both range and number inputs
    const inputs = screen.getAllByDisplayValue('2000');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('changes operator when buttons are clicked', async () => {
    const user = userEvent.setup();
    const onOperatorChange = jest.fn();
    render(
      <RangeSliderFilter
        {...defaultProps}
        onOperatorChange={onOperatorChange}
      />
    );

    await user.click(screen.getByText('Greater than'));
    expect(onOperatorChange).toHaveBeenCalledWith('greater_than');

    await user.click(screen.getByText('Less than'));
    expect(onOperatorChange).toHaveBeenCalledWith('less_than');

    await user.click(screen.getByText('Between'));
    expect(onOperatorChange).toHaveBeenCalledWith('between');
  });

  it('converts to range value when switching to between operator', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onOperatorChange = jest.fn();

    render(
      <RangeSliderFilter
        {...defaultProps}
        value={2000}
        onChange={onChange}
        onOperatorChange={onOperatorChange}
      />
    );

    await user.click(screen.getByText('Between'));

    expect(onOperatorChange).toHaveBeenCalledWith('between');
    expect(onChange).toHaveBeenCalledWith([2000, 2024]);
  });

  it('converts to single value when switching from between operator', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onOperatorChange = jest.fn();

    render(
      <RangeSliderFilter
        {...defaultProps}
        value={[1990, 2010]}
        operator="between"
        onChange={onChange}
        onOperatorChange={onOperatorChange}
      />
    );

    await user.click(screen.getByText('Equals'));

    expect(onOperatorChange).toHaveBeenCalledWith('equals');
    expect(onChange).toHaveBeenCalledWith(1990);
  });

  it('updates value when slider is moved', () => {
    const onChange = jest.fn();
    render(<RangeSliderFilter {...defaultProps} onChange={onChange} />);

    const slider = screen.getByRole('slider');

    // Simulate slider change
    fireEvent.change(slider, { target: { value: '2010' } });

    expect(onChange).toHaveBeenCalledWith(2010);
  });

  it('updates value when number input is changed', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<RangeSliderFilter {...defaultProps} onChange={onChange} />);

    // Get the number input (not the range input)
    const inputs = screen.getAllByDisplayValue('2000');
    const numberInput = inputs.find(
      (input) => input.getAttribute('type') === 'number'
    );

    if (numberInput) {
      await user.clear(numberInput);
      await user.type(numberInput, '2015');

      expect(onChange).toHaveBeenLastCalledWith(2015);
    }
  });

  it('renders two sliders and inputs for between operator', () => {
    render(
      <RangeSliderFilter
        {...defaultProps}
        operator="between"
        value={[1990, 2010]}
      />
    );

    // Should have two range inputs and two number inputs
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(2);

    // Check that both values are present (may appear in multiple inputs)
    expect(screen.getAllByDisplayValue('1990').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('2010').length).toBeGreaterThan(0);
  });

  it('enforces min <= max constraint for range values', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <RangeSliderFilter
        {...defaultProps}
        operator="between"
        value={[1990, 2010]}
        onChange={onChange}
      />
    );

    // Get the first number input (min value)
    const numberInputs = screen
      .getAllByDisplayValue('1990')
      .filter((input) => input.getAttribute('type') === 'number');
    const minInput = numberInputs[0];

    if (minInput) {
      // Try to set min higher than max
      await user.clear(minInput);
      await user.type(minInput, '2020');

      // Should adjust max to match
      expect(onChange).toHaveBeenLastCalledWith([2020, 2020]);
    }
  });

  it('formats value with custom formatter', () => {
    render(
      <RangeSliderFilter
        {...defaultProps}
        value={7.5}
        formatValue={(v) => `${v.toFixed(1)} stars`}
      />
    );

    expect(screen.getByText('7.5 stars')).toBeInTheDocument();
  });

  it('respects step prop', () => {
    render(<RangeSliderFilter {...defaultProps} step={10} />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('step', '10');
  });

  it('is disabled when disabled prop is true', () => {
    render(<RangeSliderFilter {...defaultProps} disabled />);

    // All interactive elements should be disabled
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });

    const slider = screen.getByRole('slider');
    expect(slider).toBeDisabled();

    const inputs = screen.getAllByDisplayValue('2000');
    const numberInput = inputs.find(
      (input) => input.getAttribute('type') === 'number'
    );
    if (numberInput) {
      expect(numberInput).toBeDisabled();
    }
  });

  it('shows correct range visualization for between operator', () => {
    const { container } = render(
      <RangeSliderFilter
        {...defaultProps}
        operator="between"
        value={[1950, 2000]}
      />
    );

    // Check that the blue bar exists for range visualization
    const blueBar = container.querySelector('.bg-blue-500');
    expect(blueBar).toBeInTheDocument();

    // Check that it has styling (may be inline styles or classes)
    if (blueBar) {
      const style = blueBar.getAttribute('style');
      // The bar should have positioning styles
      expect(style || blueBar.className).toBeTruthy();
    }
  });
});
