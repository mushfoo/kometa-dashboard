import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { useForm } from '../../../hooks/useForm';
import { FormSelect } from '../FormSelect';

const TestSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  type: z.string().optional(),
});

type TestFormData = z.infer<typeof TestSchema>;

const mockOptions = [
  { value: 'movies', label: 'Movies' },
  { value: 'tv', label: 'TV Shows' },
  { value: 'music', label: 'Music' },
  { value: 'disabled', label: 'Disabled Option', disabled: true },
];

function TestFormWrapper() {
  const form = useForm<TestFormData>({ schema: TestSchema });

  return (
    <form>
      <FormSelect
        form={form}
        name="category"
        label="Category"
        options={mockOptions}
        placeholder="Select a category"
        helpText="Choose your content type"
        required
      />
      <FormSelect
        form={form}
        name="type"
        label="Type"
        options={mockOptions}
        searchable={false}
      />
    </form>
  );
}

describe('FormSelect', () => {
  it('renders correctly with all props', () => {
    render(<TestFormWrapper />);

    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByText(/select a category/i)).toBeInTheDocument();
    expect(screen.getByText(/choose your content type/i)).toBeInTheDocument();
  });

  it('opens dropdown when clicked', async () => {
    render(<TestFormWrapper />);

    const select = screen.getByRole('button', { name: /category/i });
    fireEvent.click(select);

    await waitFor(() => {
      expect(screen.getByText('Movies')).toBeInTheDocument();
      expect(screen.getByText('TV Shows')).toBeInTheDocument();
      expect(screen.getByText('Music')).toBeInTheDocument();
    });
  });

  it('selects option when clicked', async () => {
    render(<TestFormWrapper />);

    const select = screen.getByRole('button', { name: /category/i });
    fireEvent.click(select);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Movies'));
    });

    expect(screen.getByText('Movies')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows search input when searchable is true', async () => {
    render(<TestFormWrapper />);

    const select = screen.getByRole('button', { name: /category/i });
    fireEvent.click(select);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search options/i)
      ).toBeInTheDocument();
    });
  });

  it('filters options when searching', async () => {
    render(<TestFormWrapper />);

    const select = screen.getByRole('button', { name: /category/i });
    fireEvent.click(select);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search options/i);
      fireEvent.change(searchInput, { target: { value: 'tv' } });
    });

    expect(screen.getByText('TV Shows')).toBeInTheDocument();
    expect(screen.queryByText('Movies')).not.toBeInTheDocument();
  });

  it('does not show search input when searchable is false', async () => {
    render(<TestFormWrapper />);

    const typeSelect = screen.getByRole('button', { name: /type/i });
    fireEvent.click(typeSelect);

    await waitFor(() => {
      expect(screen.getByText('Movies')).toBeInTheDocument();
    });

    expect(
      screen.queryByPlaceholderText(/search options/i)
    ).not.toBeInTheDocument();
  });

  it('handles disabled options correctly', async () => {
    render(<TestFormWrapper />);

    const select = screen.getByRole('button', { name: /category/i });
    fireEvent.click(select);

    await waitFor(() => {
      const disabledOption = screen.getByText('Disabled Option');
      expect(disabledOption).toHaveClass('text-gray-400');
      expect(disabledOption).toHaveClass('cursor-not-allowed');
    });
  });

  it('closes dropdown when clicking outside', async () => {
    render(<TestFormWrapper />);

    const select = screen.getByRole('button', { name: /category/i });
    fireEvent.click(select);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('supports keyboard navigation', async () => {
    render(<TestFormWrapper />);

    const select = screen.getByRole('button', { name: /category/i });

    fireEvent.keyDown(select, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.keyDown(select, { key: ' ' });

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});
