import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionBuilder } from '../CollectionBuilder';

describe('CollectionBuilder', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<CollectionBuilder onSave={mockOnSave} />);

    // Basic Information
    expect(screen.getByLabelText(/collection name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/poster url/i)).toBeInTheDocument();

    // Collection Type - check for tab buttons
    expect(
      screen.getByRole('tab', { name: /smart collection/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /manual collection/i })
    ).toBeInTheDocument();

    // Metadata Settings
    expect(screen.getByLabelText(/sort order/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/collection mode/i)).toBeInTheDocument();

    // Visibility Settings
    expect(screen.getByText(/visible in library/i)).toBeInTheDocument();
    expect(screen.getByText(/visible on home screen/i)).toBeInTheDocument();
    expect(screen.getByText(/visible to shared users/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<CollectionBuilder onSave={mockOnSave} />);

    const submitButton = screen.getByRole('button', {
      name: /create collection/i,
    });
    await user.click(submitButton);

    // The form should not submit without required fields
    await waitFor(() => {
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    render(<CollectionBuilder onSave={mockOnSave} />);

    // Fill in form
    await user.type(
      screen.getByLabelText(/collection name/i),
      'My Test Collection'
    );
    await user.type(
      screen.getByLabelText(/description/i),
      'A test collection description'
    );
    await user.type(
      screen.getByLabelText(/poster url/i),
      'https://example.com/poster.jpg'
    );

    // Change sort order
    await user.click(screen.getByLabelText(/sort order/i));
    await user.click(screen.getByRole('option', { name: /release date/i }));

    // Submit form
    await user.click(
      screen.getByRole('button', { name: /create collection/i })
    );

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'My Test Collection',
        description: 'A test collection description',
        poster: 'https://example.com/poster.jpg',
        type: 'smart',
        sort_order: 'release',
        visible_library: true,
        visible_home: false,
        visible_shared: false,
        collection_mode: 'default',
      });
    });
  });

  it('switches between smart and manual collection types', async () => {
    const user = userEvent.setup();
    render(<CollectionBuilder onSave={mockOnSave} />);

    // Default should be smart
    expect(
      screen.getByText(/smart collections automatically include items/i)
    ).toBeInTheDocument();

    // Switch to manual
    await user.click(screen.getByText(/manual collection/i));

    await waitFor(() => {
      expect(
        screen.getByText(/manual collections require you to explicitly add/i)
      ).toBeInTheDocument();
    });
  });

  it('resets form when reset button is clicked', async () => {
    const user = userEvent.setup();
    render(<CollectionBuilder onSave={mockOnSave} />);

    // Fill in some data
    await user.type(
      screen.getByLabelText(/collection name/i),
      'Test Collection'
    );

    // Click reset
    await user.click(screen.getByRole('button', { name: /reset/i }));

    // Check that fields are cleared
    expect(screen.getByLabelText(/collection name/i)).toHaveValue('');
  });

  it('updates preview when form values change', async () => {
    const user = userEvent.setup();
    render(<CollectionBuilder onSave={mockOnSave} />);

    // Type collection name
    await user.type(screen.getByLabelText(/collection name/i), 'Preview Test');

    // Check preview updates
    expect(screen.getByText('Preview Test')).toBeInTheDocument();
  });

  it('handles visibility checkboxes', async () => {
    const user = userEvent.setup();
    render(<CollectionBuilder onSave={mockOnSave} />);

    // Toggle visibility checkboxes
    const homeCheckbox = screen.getByRole('checkbox', {
      name: /visible on home screen/i,
    });
    const sharedCheckbox = screen.getByRole('checkbox', {
      name: /visible to shared users/i,
    });

    await user.click(homeCheckbox);
    await user.click(sharedCheckbox);

    // Fill required field
    await user.type(
      screen.getByLabelText(/collection name/i),
      'Visibility Test'
    );

    // Submit
    await user.click(
      screen.getByRole('button', { name: /create collection/i })
    );

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          visible_home: true,
          visible_shared: true,
        })
      );
    });
  });

  it('displays poster image when valid URL is provided', async () => {
    const user = userEvent.setup();
    render(<CollectionBuilder onSave={mockOnSave} />);

    const posterUrl = 'https://example.com/valid-poster.jpg';
    await user.type(screen.getByLabelText(/poster url/i), posterUrl);

    // Check that image element is rendered
    const posterImage = screen.getByAltText('Collection poster');
    expect(posterImage).toHaveAttribute('src', posterUrl);
  });

  it('handles update preview button click', async () => {
    const user = userEvent.setup();
    render(<CollectionBuilder onSave={mockOnSave} />);

    // The default is smart collection, and the preview button should be disabled initially
    const previewButton = screen.getByRole('button', {
      name: /update preview/i,
    });

    // Button should be disabled when no filters are added
    expect(previewButton).toBeDisabled();

    // Add a genre filter
    await user.click(screen.getByText(/genre/i));

    // Wait for the genre filter to be added
    await waitFor(() => {
      expect(screen.getByText(/genres/i)).toBeInTheDocument();
    });

    // At this point, the auto-preview should trigger due to the useEffect
    // We should see either loading state or results
    await waitFor(
      () => {
        const hasPreviewContent = screen.queryByText(
          /generating preview|total matches|please add at least one filter/i
        );
        expect(hasPreviewContent).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('loads initial data when provided', () => {
    const initialData = {
      name: 'Existing Collection',
      description: 'An existing collection',
      type: 'manual' as const,
      sort_order: 'added' as const,
    };

    render(<CollectionBuilder onSave={mockOnSave} initialData={initialData} />);

    expect(screen.getByLabelText(/collection name/i)).toHaveValue(
      'Existing Collection'
    );
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      'An existing collection'
    );
    // For select elements, check the displayed text instead
    expect(screen.getByText('Date Added')).toBeInTheDocument();
  });

  it('validates poster URL format', async () => {
    const user = userEvent.setup();
    render(<CollectionBuilder onSave={mockOnSave} />);

    // Fill required fields
    await user.type(screen.getByLabelText(/collection name/i), 'URL Test');

    // Enter invalid URL
    await user.type(screen.getByLabelText(/poster url/i), 'not-a-url');

    // Submit
    await user.click(
      screen.getByRole('button', { name: /create collection/i })
    );

    await waitFor(() => {
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });
});
