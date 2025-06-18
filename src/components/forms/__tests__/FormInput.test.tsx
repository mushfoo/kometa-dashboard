import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { z } from 'zod';
import { useForm } from '../../../hooks/useForm';
import { FormInput } from '../FormInput';

const TestSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required'),
});

type TestFormData = z.infer<typeof TestSchema>;

function TestFormWrapper() {
  const form = useForm<TestFormData>({ schema: TestSchema });

  return (
    <form>
      <FormInput
        form={form}
        name="email"
        label="Email Address"
        type="email"
        placeholder="Enter your email"
        helpText="We'll never share your email"
        required
      />
      <FormInput
        form={form}
        name="name"
        label="Full Name"
        placeholder="Enter your name"
      />
    </form>
  );
}

describe('FormInput', () => {
  it('renders correctly with all props', () => {
    render(<TestFormWrapper />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter your email/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/we'll never share your email/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/email address/i)).toHaveClass(
      "after:content-['*']"
    );
  });

  it('displays validation errors when field is touched and invalid', async () => {
    render(<TestFormWrapper />);

    const emailInput = screen.getByLabelText(/email address/i);

    // Type invalid email and blur to trigger validation
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);
    });

    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });

    // Help text should be hidden when error is shown
    expect(
      screen.queryByText(/we'll never share your email/i)
    ).not.toBeInTheDocument();
  });

  it('shows correct styling for error state', async () => {
    render(<TestFormWrapper />);

    const emailInput = screen.getByLabelText(/email address/i);

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'invalid' } });
      fireEvent.blur(emailInput);
    });

    await waitFor(() => {
      expect(emailInput).toHaveClass('border-red-300');
      expect(screen.getByText(/email address/i)).toHaveClass('text-red-700');
    });
  });

  it('supports different input types', () => {
    function TestComponent() {
      const form = useForm();
      return <FormInput form={form} name="test" type="password" />;
    }

    const { rerender } = render(<TestComponent />);

    expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password');

    function TestNumberComponent() {
      const form = useForm();
      return <FormInput form={form} name="test" type="number" />;
    }

    rerender(<TestNumberComponent />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number');
  });

  it('handles disabled state correctly', () => {
    function TestComponent() {
      const form = useForm();
      return <FormInput form={form} name="test" label="Test Input" disabled />;
    }

    render(<TestComponent />);

    const input = screen.getByLabelText(/test input/i);
    expect(input).toBeDisabled();
    expect(input).toHaveClass('disabled:bg-gray-50');
  });

  it('provides proper accessibility attributes', () => {
    function TestComponent() {
      const form = useForm();
      return (
        <FormInput
          form={form}
          name="test"
          label="Test Input"
          helpText="This is help text"
        />
      );
    }

    render(<TestComponent />);

    const input = screen.getByLabelText(/test input/i);
    expect(input).toHaveAttribute('aria-describedby', 'test-description');
    expect(input).toHaveAttribute('id', 'test');
  });
});
