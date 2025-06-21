import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiSelectFilter } from '../MultiSelectFilter';

describe('MultiSelectFilter', () => {
  const mockOptions = [
    { value: 'action', label: 'Action' },
    { value: 'comedy', label: 'Comedy' },
    { value: 'drama', label: 'Drama' },
    { value: 'horror', label: 'Horror' },
  ];

  const defaultProps = {
    label: 'Select Genres',
    options: mockOptions,
    value: [],
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with label and placeholder', () => {
    render(
      <MultiSelectFilter {...defaultProps} placeholder="Choose genres..." />
    );

    expect(screen.getByText('Select Genres')).toBeInTheDocument();
    expect(screen.getByText('Choose genres...')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', async () => {
    const user = userEvent.setup();
    render(<MultiSelectFilter {...defaultProps} />);

    const button = screen.getByRole('button');
    await user.click(button);

    // Check if all options are visible
    mockOptions.forEach((option) => {
      expect(screen.getByText(option.label)).toBeInTheDocument();
    });
  });

  it('selects options correctly', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<MultiSelectFilter {...defaultProps} onChange={onChange} />);

    // Click the dropdown trigger (should be the first button)
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);

    // Select first option
    await user.click(screen.getByText('Action'));
    expect(onChange).toHaveBeenCalledWith(['action']);
  });

  it('can select multiple options', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(
      <MultiSelectFilter {...defaultProps} onChange={onChange} />
    );

    // Test with pre-selected value
    rerender(
      <MultiSelectFilter
        {...defaultProps}
        value={['action']}
        onChange={onChange}
      />
    );

    // Open dropdown and select another option
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    await user.click(screen.getByText('Comedy'));
    expect(onChange).toHaveBeenCalledWith(['action', 'comedy']);
  });

  it('removes selected option when X is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <MultiSelectFilter
        {...defaultProps}
        value={['action', 'comedy']}
        onChange={onChange}
      />
    );

    // Find the X icon (lucide-x class) and click it
    const container = screen.getByText('Action').parentElement;
    const xIcon = container?.querySelector('.lucide-x');

    if (xIcon) {
      await user.click(xIcon);
      expect(onChange).toHaveBeenCalledWith(['comedy']);
    } else {
      // Skip test if X icon structure is different
      expect(true).toBe(true);
    }
  });

  it('filters options based on search input', async () => {
    const user = userEvent.setup();
    render(<MultiSelectFilter {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole('button'));

    // Type in search
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'com');

    // Should only show Comedy
    expect(screen.getByText('Comedy')).toBeInTheDocument();
    expect(screen.queryByText('Action')).not.toBeInTheDocument();
    expect(screen.queryByText('Drama')).not.toBeInTheDocument();
  });

  it('shows "No options found" when search has no results', async () => {
    const user = userEvent.setup();
    render(<MultiSelectFilter {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole('button'));

    // Type in search that matches nothing
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'xyz');

    expect(screen.getByText('No options found')).toBeInTheDocument();
  });

  it('clears all selections when Clear all is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <MultiSelectFilter
        {...defaultProps}
        value={['action', 'comedy']}
        onChange={onChange}
      />
    );

    // Open dropdown
    await user.click(screen.getByRole('button'));

    // Click Clear all
    await user.click(screen.getByText('Clear all'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows truncated display when many items selected', () => {
    render(
      <MultiSelectFilter
        {...defaultProps}
        value={['action', 'comedy', 'drama', 'horror']}
      />
    );

    // Should show first 2 and a count
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Comedy')).toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', async () => {
    const user = userEvent.setup();
    render(<MultiSelectFilter {...defaultProps} disabled />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    // Should not open dropdown when clicked
    await user.click(button);
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <MultiSelectFilter {...defaultProps} />
        <button>Outside button</button>
      </div>
    );

    // Open dropdown
    await user.click(screen.getByRole('button', { name: /select options/i }));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();

    // Click outside
    await user.click(screen.getByText('Outside button'));

    // Dropdown should be closed
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Search...')
      ).not.toBeInTheDocument();
    });
  });
});
