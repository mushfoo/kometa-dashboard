import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { useForm } from '../../../hooks/useForm';
import { FormTextarea } from '../FormTextarea';

const TestSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  comments: z.string().optional(),
});

type TestFormData = z.infer<typeof TestSchema>;

function TestFormWrapper() {
  const form = useForm<TestFormData>({ schema: TestSchema });

  return (
    <form>
      <FormTextarea
        form={form}
        name="description"
        label="Description"
        placeholder="Enter description"
        helpText="Provide a detailed description"
        required
        rows={5}
        maxLength={200}
      />
      <FormTextarea form={form} name="comments" label="Comments" rows={3} />
    </form>
  );
}

describe('FormTextarea', () => {
  it('renders correctly with all props', () => {
    render(<TestFormWrapper />);

    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter description/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/provide a detailed description/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/0\/200/)).toBeInTheDocument();
  });

  it('shows required indicator for required fields', () => {
    render(<TestFormWrapper />);

    const requiredLabel = screen
      .getByLabelText(/description/i)
      .closest('div')
      ?.querySelector('label');
    expect(requiredLabel).toHaveClass("after:content-['*']");
  });

  it('handles text input and character counting', () => {
    render(<TestFormWrapper />);

    const textarea = screen.getByLabelText(/description/i);
    const testText = 'This is a test description';

    fireEvent.change(textarea, { target: { value: testText } });

    expect(textarea).toHaveValue(testText);
    expect(screen.getByText(`${testText.length}/200`)).toBeInTheDocument();
  });

  it('updates character count color based on length', () => {
    render(<TestFormWrapper />);

    const textarea = screen.getByLabelText(/description/i);

    // Test normal state (< 90% of max)
    fireEvent.change(textarea, { target: { value: 'Short text' } });
    expect(screen.getByText('10/200')).toHaveClass('text-gray-500');

    // Test warning state (> 90% of max)
    const warningText = 'a'.repeat(185); // 185 characters (92.5% of 200)
    fireEvent.change(textarea, { target: { value: warningText } });
    expect(screen.getByText('185/200')).toHaveClass('text-yellow-600');

    // Test danger state (>= max)
    const maxText = 'a'.repeat(200);
    fireEvent.change(textarea, { target: { value: maxText } });
    expect(screen.getByText('200/200')).toHaveClass('text-red-600');
  });

  it('displays validation errors when field is touched and invalid', async () => {
    render(<TestFormWrapper />);

    const textarea = screen.getByLabelText(/description/i);

    // Type short text and blur to trigger validation
    fireEvent.change(textarea, { target: { value: 'short' } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(
        screen.getByText(/description must be at least 10 characters/i)
      ).toBeInTheDocument();
    });

    // Help text should be hidden when error is shown
    expect(
      screen.queryByText(/provide a detailed description/i)
    ).not.toBeInTheDocument();
  });

  it('shows correct styling for error state', async () => {
    render(<TestFormWrapper />);

    const textarea = screen.getByLabelText(/description/i);

    fireEvent.change(textarea, { target: { value: 'short' } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(textarea).toHaveClass('border-red-300');
      expect(screen.getByText(/description/i)).toHaveClass('text-red-700');
    });
  });

  it('handles disabled state correctly', () => {
    const form = useForm();

    render(
      <FormTextarea form={form} name="test" label="Test Textarea" disabled />
    );

    const textarea = screen.getByLabelText(/test textarea/i);
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveClass('disabled:bg-gray-50');
  });

  it('provides proper accessibility attributes', () => {
    render(<TestFormWrapper />);

    const textarea = screen.getByLabelText(/description/i);
    expect(textarea).toHaveAttribute(
      'aria-describedby',
      'description-description description-count'
    );
    expect(textarea).toHaveAttribute('id', 'description');
  });

  it('respects rows prop', () => {
    render(<TestFormWrapper />);

    const descriptionTextarea = screen.getByLabelText(/description/i);
    const commentsTextarea = screen.getByLabelText(/comments/i);

    expect(descriptionTextarea).toHaveAttribute('rows', '5');
    expect(commentsTextarea).toHaveAttribute('rows', '3');
  });

  it('enforces maxLength when provided', () => {
    render(<TestFormWrapper />);

    const textarea = screen.getByLabelText(/description/i);
    expect(textarea).toHaveAttribute('maxLength', '200');
  });

  it('does not show character count when maxLength is not provided', () => {
    render(<TestFormWrapper />);

    const commentsTextarea = screen.getByLabelText(/comments/i);
    fireEvent.change(commentsTextarea, { target: { value: 'Some comments' } });

    // Should not show character count for comments field
    expect(screen.queryByText(/\/$/)).not.toBeInTheDocument();
  });
});
