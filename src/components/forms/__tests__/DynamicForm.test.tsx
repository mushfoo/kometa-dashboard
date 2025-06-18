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
import { DynamicForm } from '../DynamicForm';

const TestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  age: z.number().min(18, 'Must be at least 18'),
  newsletter: z.boolean().default(false),
  category: z.enum(['movies', 'tv', 'music']),
  bio: z.string().optional(),
  website: z.string().url('Invalid URL').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

function TestFormWrapper() {
  const form = useForm({ schema: TestSchema });

  return (
    <form>
      <DynamicForm
        form={form}
        schema={TestSchema}
        fieldConfigs={{
          bio: {
            type: 'textarea',
            label: 'Biography',
            helpText: 'Tell us about yourself',
            maxLength: 500,
          },
          category: {
            type: 'select',
            label: 'Content Category',
            helpText: 'Choose your preferred content type',
          },
          newsletter: {
            label: 'Subscribe to Newsletter',
            helpText: 'Get updates about new features',
          },
        }}
      />
    </form>
  );
}

function TestSectionedFormWrapper() {
  const form = useForm({ schema: TestSchema });

  return (
    <form>
      <DynamicForm
        form={form}
        schema={TestSchema}
        fieldConfigs={{
          name: { section: 'personal', order: 1 },
          email: { section: 'personal', order: 2 },
          age: { section: 'personal', order: 3 },
          bio: {
            section: 'personal',
            order: 4,
            type: 'textarea',
            conditional: { field: 'age', value: 21, operator: 'equals' },
          },
          website: { section: 'contact', order: 1 },
          newsletter: { section: 'preferences', order: 1 },
          category: { section: 'preferences', order: 2 },
          password: { section: 'security', order: 1 },
        }}
        sectionConfigs={{
          personal: {
            title: 'Personal Information',
            description: 'Basic information about you',
          },
          contact: {
            title: 'Contact Details',
            collapsible: true,
            defaultExpanded: false,
          },
          preferences: {
            title: 'Preferences',
          },
          security: {
            title: 'Security Settings',
            collapsible: true,
          },
        }}
      />
    </form>
  );
}

describe('DynamicForm', () => {
  it('renders form fields based on schema inference', () => {
    render(<TestFormWrapper />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/age/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/subscribe to newsletter/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/content category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/biography/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('infers correct field types from schema', () => {
    render(<TestFormWrapper />);

    // String fields should be text inputs
    expect(screen.getByLabelText(/name/i)).toHaveAttribute('type', 'text');

    // Email field should be email input
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email');

    // Number field should be number input
    expect(screen.getByLabelText(/age/i)).toHaveAttribute('type', 'number');

    // Boolean field should be checkbox
    expect(screen.getByLabelText(/subscribe to newsletter/i)).toHaveAttribute(
      'type',
      'checkbox'
    );

    // URL field should be URL input
    expect(screen.getByLabelText(/website/i)).toHaveAttribute('type', 'url');

    // Password field should be password input
    expect(screen.getByLabelText(/password/i)).toHaveAttribute(
      'type',
      'password'
    );

    // Bio should be textarea
    expect(screen.getByLabelText(/biography/i)).toBeInstanceOf(
      HTMLTextAreaElement
    );
  });

  it('applies custom field configurations', () => {
    render(<TestFormWrapper />);

    // Custom label and help text
    expect(screen.getByText(/biography/i)).toBeInTheDocument();
    expect(screen.getByText(/tell us about yourself/i)).toBeInTheDocument();

    // Custom help text for other fields
    expect(
      screen.getByText(/choose your preferred content type/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/get updates about new features/i)
    ).toBeInTheDocument();
  });

  it('handles enum fields as select dropdowns', () => {
    render(<TestFormWrapper />);

    const categorySelect = screen.getByRole('button', {
      name: /content category/i,
    });
    fireEvent.click(categorySelect);

    expect(screen.getByText('Movies')).toBeInTheDocument();
    expect(screen.getByText('Tv')).toBeInTheDocument();
    expect(screen.getByText('Music')).toBeInTheDocument();
  });

  it('organizes fields into sections when configured', () => {
    render(<TestSectionedFormWrapper />);

    expect(screen.getByText('Personal Information')).toBeInTheDocument();
    expect(screen.getByText('Basic information about you')).toBeInTheDocument();
    expect(screen.getByText('Contact Details')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByText('Security Settings')).toBeInTheDocument();
  });

  it('supports collapsible sections', () => {
    render(<TestSectionedFormWrapper />);

    // Contact section should be collapsed by default
    const contactSection = screen.getByText('Contact Details');
    expect(screen.queryByLabelText(/website/i)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(contactSection);
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(contactSection);
    expect(screen.queryByLabelText(/website/i)).not.toBeInTheDocument();
  });

  it('handles conditional field display', async () => {
    render(<TestSectionedFormWrapper />);

    // Bio field should not be visible initially (age != 21)
    expect(screen.queryByLabelText(/bio/i)).not.toBeInTheDocument();

    // Set age to 21
    const ageInput = screen.getByLabelText(/age/i);
    await act(async () => {
      fireEvent.change(ageInput, { target: { value: '21' } });
    });

    // Bio field should now be visible
    await waitFor(() => {
      expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
    });
  });

  it('maintains field order within sections', () => {
    render(<TestSectionedFormWrapper />);

    const personalSection = screen
      .getByText('Personal Information')
      .closest('div');
    const inputs = personalSection?.querySelectorAll('input, textarea');

    // Should be in order: name, email, age (bio conditional)
    expect(inputs?.[0]).toHaveAttribute('id', 'name');
    expect(inputs?.[1]).toHaveAttribute('id', 'email');
    expect(inputs?.[2]).toHaveAttribute('id', 'age');
  });

  it('handles required field indicators', () => {
    render(<TestFormWrapper />);

    // Required fields should have asterisk indicator
    const nameLabel = screen.getByText(/^name/i);
    expect(nameLabel).toHaveClass("after:content-['*']");

    // Optional fields should not have asterisk
    const bioLabel = screen.getByText(/biography/i);
    expect(bioLabel).not.toHaveClass("after:content-['*']");
  });

  it('supports form validation through schema', async () => {
    render(<TestFormWrapper />);

    const emailInput = screen.getByLabelText(/email/i);

    // Enter invalid email
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);
    });

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('handles empty schema gracefully', () => {
    const EmptySchema = z.object({});

    function EmptyFormWrapper() {
      const form = useForm({ schema: EmptySchema });
      return <DynamicForm form={form} schema={EmptySchema} />;
    }

    const { container } = render(<EmptyFormWrapper />);

    // Should render without crashing
    expect(container.firstChild).toBeInTheDocument();
  });
});
