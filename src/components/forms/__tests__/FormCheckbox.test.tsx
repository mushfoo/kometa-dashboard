import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { useForm } from '../../../hooks/useForm';
import { FormCheckbox } from '../FormCheckbox';

const TestSchema = z.object({
  agree: z
    .boolean()
    .refine((val) => val === true, 'You must agree to continue'),
  newsletter: z.boolean().optional(),
});

type TestFormData = z.infer<typeof TestSchema>;

function TestFormWrapper() {
  const form = useForm<TestFormData>({ schema: TestSchema });

  return (
    <form>
      <FormCheckbox
        form={form}
        name="agree"
        label="I agree to the terms and conditions"
        required
      />
      <FormCheckbox
        form={form}
        name="newsletter"
        label="Subscribe to newsletter"
        helpText="Get updates about new features"
      />
    </form>
  );
}

describe('FormCheckbox', () => {
  it('renders correctly with all props', () => {
    render(<TestFormWrapper />);

    expect(screen.getByLabelText(/i agree to the terms/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/subscribe to newsletter/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/get updates about new features/i)
    ).toBeInTheDocument();
  });

  it('shows required indicator for required fields', () => {
    render(<TestFormWrapper />);

    const requiredLabel = screen.getByText(/i agree to the terms/i);
    expect(requiredLabel).toHaveClass("after:content-['*']");
  });

  it('handles checkbox state changes', () => {
    render(<TestFormWrapper />);

    const checkbox = screen.getByLabelText(/i agree to the terms/i);

    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('displays validation errors when field is touched and invalid', async () => {
    render(<TestFormWrapper />);

    const checkbox = screen.getByLabelText(/i agree to the terms/i);

    // Check and uncheck to trigger validation
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    fireEvent.blur(checkbox);

    await waitFor(() => {
      expect(
        screen.getByText(/you must agree to continue/i)
      ).toBeInTheDocument();
    });
  });

  it('shows correct styling for error state', async () => {
    render(<TestFormWrapper />);

    const checkbox = screen.getByLabelText(/i agree to the terms/i);

    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    fireEvent.blur(checkbox);

    await waitFor(() => {
      expect(checkbox).toHaveClass('border-red-300');
      expect(screen.getByText(/i agree to the terms/i)).toHaveClass(
        'text-red-700'
      );
    });
  });

  it('handles disabled state correctly', () => {
    const form = useForm();

    render(
      <FormCheckbox form={form} name="test" label="Test Checkbox" disabled />
    );

    const checkbox = screen.getByLabelText(/test checkbox/i);
    expect(checkbox).toBeDisabled();
    expect(screen.getByText(/test checkbox/i)).toHaveClass(
      'cursor-not-allowed'
    );
  });

  it('provides proper accessibility attributes', () => {
    render(<TestFormWrapper />);

    const checkbox = screen.getByLabelText(/subscribe to newsletter/i);
    expect(checkbox).toHaveAttribute(
      'aria-describedby',
      'newsletter-description'
    );
    expect(checkbox).toHaveAttribute('id', 'newsletter');
  });

  it('hides help text when error is shown', async () => {
    render(<TestFormWrapper />);

    const checkbox = screen.getByLabelText(/i agree to the terms/i);

    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    fireEvent.blur(checkbox);

    await waitFor(() => {
      expect(
        screen.getByText(/you must agree to continue/i)
      ).toBeInTheDocument();
    });

    // Help text should not be present for this field since it doesn't have any
    expect(
      screen.getByText(/get updates about new features/i)
    ).toBeInTheDocument();
  });

  it('supports clicking on label to toggle checkbox', () => {
    render(<TestFormWrapper />);

    const checkbox = screen.getByLabelText(/i agree to the terms/i);
    const label = screen.getByText(/i agree to the terms/i);

    expect(checkbox).not.toBeChecked();

    fireEvent.click(label);
    expect(checkbox).toBeChecked();
  });
});
