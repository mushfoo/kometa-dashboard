import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBuilder } from '../FilterBuilder';
import { FilterGroup, FilterPreset } from '@/types/filters';

describe('FilterBuilder', () => {
  const defaultFilterGroup: FilterGroup = {
    id: 'root',
    operator: 'AND',
    filters: [],
  };

  const defaultProps = {
    filters: defaultFilterGroup,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with no filters initially', () => {
    render(<FilterBuilder {...defaultProps} />);

    // Should show add filter buttons
    expect(screen.getByText('Add Genre Filter')).toBeInTheDocument();
    expect(screen.getByText('Add Year Filter')).toBeInTheDocument();
    expect(screen.getByText('Add Rating Filter')).toBeInTheDocument();
    expect(screen.getByText('Add Availability Filter')).toBeInTheDocument();
    expect(screen.getByText('Add Content Type Filter')).toBeInTheDocument();
    expect(screen.getByText('Add Resolution Filter')).toBeInTheDocument();
  });

  it('adds a genre filter when button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FilterBuilder {...defaultProps} onChange={onChange} />);

    await user.click(screen.getByText('Add Genre Filter'));

    expect(onChange).toHaveBeenCalledWith({
      id: 'root',
      operator: 'AND',
      filters: [
        expect.objectContaining({
          field: 'genre',
          operator: 'contains',
          value: [],
          enabled: true,
        }),
      ],
    });
  });

  it('adds different filter types', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FilterBuilder {...defaultProps} onChange={onChange} />);

    // Add year filter
    await user.click(screen.getByText('Add Year Filter'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          expect.objectContaining({
            field: 'year',
            operator: 'equals',
            value: new Date().getFullYear(),
          }),
        ],
      })
    );

    // Add rating filter
    onChange.mockClear();
    await user.click(screen.getByText('Add Rating Filter'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          expect.objectContaining({
            field: 'rating',
            operator: 'greater_than',
            value: 7,
          }),
        ],
      })
    );
  });

  it('shows operator selection when multiple filters exist', () => {
    const filtersWithTwo: FilterGroup = {
      ...defaultFilterGroup,
      filters: [
        {
          id: '1',
          field: 'genre',
          operator: 'contains',
          value: ['action'],
          enabled: true,
        },
        {
          id: '2',
          field: 'year',
          operator: 'equals',
          value: 2023,
          enabled: true,
        },
      ],
    };

    render(<FilterBuilder {...defaultProps} filters={filtersWithTwo} />);

    // Should show operator buttons
    expect(screen.getByText('AND (all must match)')).toBeInTheDocument();
    expect(screen.getByText('OR (any can match)')).toBeInTheDocument();
  });

  it('changes filter operator', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const filtersWithTwo: FilterGroup = {
      ...defaultFilterGroup,
      filters: [
        {
          id: '1',
          field: 'genre',
          operator: 'contains',
          value: ['action'],
          enabled: true,
        },
        {
          id: '2',
          field: 'year',
          operator: 'equals',
          value: 2023,
          enabled: true,
        },
      ],
    };

    render(
      <FilterBuilder
        {...defaultProps}
        filters={filtersWithTwo}
        onChange={onChange}
      />
    );

    await user.click(screen.getByText('OR (any can match)'));

    expect(onChange).toHaveBeenCalledWith({
      ...filtersWithTwo,
      operator: 'OR',
    });
  });

  it('removes a filter', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const filterWithOne: FilterGroup = {
      ...defaultFilterGroup,
      filters: [
        {
          id: '1',
          field: 'genre',
          operator: 'contains',
          value: ['action'],
          enabled: true,
        },
      ],
    };

    render(
      <FilterBuilder
        {...defaultProps}
        filters={filterWithOne}
        onChange={onChange}
      />
    );

    // Find and click the trash icon
    const deleteButton = screen.getByRole('button', { name: '' });
    const trashButton = Array.from(
      deleteButton.parentElement?.querySelectorAll('button') || []
    ).find((btn) => btn.querySelector('svg[class*="lucide-trash"]'));

    if (trashButton) {
      await user.click(trashButton);
      expect(onChange).toHaveBeenCalledWith({
        ...filterWithOne,
        filters: [],
      });
    }
  });

  it('shows validation error for invalid filter', () => {
    const invalidFilter: FilterGroup = {
      ...defaultFilterGroup,
      filters: [
        {
          id: '1',
          field: 'genre',
          operator: 'contains',
          value: [],
          enabled: true,
        }, // Empty genres
      ],
    };

    render(<FilterBuilder {...defaultProps} filters={invalidFilter} />);

    expect(
      screen.getByText('Please complete this filter configuration')
    ).toBeInTheDocument();
  });

  it('saves a preset', async () => {
    const user = userEvent.setup();
    const onSavePreset = jest.fn();
    const filterWithOne: FilterGroup = {
      ...defaultFilterGroup,
      filters: [
        {
          id: '1',
          field: 'genre',
          operator: 'contains',
          value: ['action'],
          enabled: true,
        },
      ],
    };

    render(
      <FilterBuilder
        {...defaultProps}
        filters={filterWithOne}
        onSavePreset={onSavePreset}
      />
    );

    // Click Save as Preset
    await user.click(screen.getByText('Save as Preset'));

    // Fill in preset details
    await user.type(
      screen.getByPlaceholderText('e.g., Action Movies 2020+'),
      'My Preset'
    );
    await user.type(
      screen.getByPlaceholderText('Describe what this preset filters for...'),
      'Test description'
    );

    // Save
    await user.click(screen.getByText('Save Preset'));

    expect(onSavePreset).toHaveBeenCalledWith('My Preset', 'Test description');
  });

  it('loads a preset', async () => {
    const user = userEvent.setup();
    const onLoadPreset = jest.fn();
    const presets: FilterPreset[] = [
      {
        id: 'preset-1',
        name: 'Action Movies',
        filterGroup: {
          id: 'root',
          operator: 'AND',
          filters: [
            {
              id: '1',
              field: 'genre',
              operator: 'contains',
              value: ['action'],
              enabled: true,
            },
          ],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    render(
      <FilterBuilder
        {...defaultProps}
        presets={presets}
        onLoadPreset={onLoadPreset}
      />
    );

    // Select preset from dropdown
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'preset-1');

    expect(onLoadPreset).toHaveBeenCalledWith(presets[0]);
  });

  it('disables Save as Preset when no filters exist', () => {
    render(<FilterBuilder {...defaultProps} onSavePreset={jest.fn()} />);

    expect(screen.queryByText('Save as Preset')).not.toBeInTheDocument();
  });

  it('cancels preset dialog', async () => {
    const user = userEvent.setup();
    const filterWithOne: FilterGroup = {
      ...defaultFilterGroup,
      filters: [
        {
          id: '1',
          field: 'genre',
          operator: 'contains',
          value: ['action'],
          enabled: true,
        },
      ],
    };

    render(
      <FilterBuilder
        {...defaultProps}
        filters={filterWithOne}
        onSavePreset={jest.fn()}
      />
    );

    // Open dialog
    await user.click(screen.getByText('Save as Preset'));
    expect(
      screen.getByPlaceholderText('e.g., Action Movies 2020+')
    ).toBeInTheDocument();

    // Cancel
    await user.click(screen.getByText('Cancel'));

    // Dialog should be closed
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('e.g., Action Movies 2020+')
      ).not.toBeInTheDocument();
    });
  });

  it('renders all filter types correctly', () => {
    const allFilters: FilterGroup = {
      ...defaultFilterGroup,
      filters: [
        {
          id: '1',
          field: 'genre',
          operator: 'contains',
          value: ['action', 'comedy'],
          enabled: true,
        },
        {
          id: '2',
          field: 'year',
          operator: 'between',
          value: [2000, 2023],
          enabled: true,
        },
        {
          id: '3',
          field: 'rating',
          operator: 'greater_than',
          value: 7.5,
          enabled: true,
        },
        {
          id: '4',
          field: 'availability',
          operator: 'equals',
          value: ['netflix'],
          enabled: true,
        },
        {
          id: '5',
          field: 'content_type',
          operator: 'equals',
          value: 'movie',
          enabled: true,
        },
        {
          id: '6',
          field: 'resolution',
          operator: 'equals',
          value: '1080p',
          enabled: true,
        },
      ],
    };

    render(<FilterBuilder {...defaultProps} filters={allFilters} />);

    // Check all filter labels are rendered
    expect(screen.getByText('genre Filter')).toBeInTheDocument();
    expect(screen.getByText('year Filter')).toBeInTheDocument();
    expect(screen.getByText('rating Filter')).toBeInTheDocument();
    expect(screen.getByText('availability Filter')).toBeInTheDocument();
    expect(screen.getByText('content type Filter')).toBeInTheDocument();
    expect(screen.getByText('resolution Filter')).toBeInTheDocument();
  });
});
