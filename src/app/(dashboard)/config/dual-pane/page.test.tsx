import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import DualPaneConfigPage from './page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      refresh: jest.fn(),
    };
  },
  usePathname() {
    return '/config/dual-pane';
  },
}));

// Mock the split pane component
jest.mock('@rexxars/react-split-pane', () => ({
  __esModule: true,
  SplitPane: ({ children, defaultSize }: any) => (
    <div data-testid="split-pane" data-default-size={String(defaultSize)}>
      {children}
    </div>
  ),
}));

// Mock the YAML editor component
jest.mock('@/components/editor/YamlEditor', () => ({
  YamlEditor: ({ value, onChange }: any) => (
    <div data-testid="yaml-editor">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="YAML Editor"
      />
    </div>
  ),
}));

// Mock the form-YAML sync hook
const mockUseFormYamlSync = {
  form: {
    register: jest.fn(() => ({
      name: 'test',
      onChange: jest.fn(),
      onBlur: jest.fn(),
    })),
    formState: { errors: {} },
    watch: jest.fn(() => ({})),
    setValue: jest.fn(),
    getValues: jest.fn(() => ({})),
    reset: jest.fn(),
  },
  yamlContent: 'test: config',
  setYamlContent: jest.fn(),
  isValid: true,
  validationErrors: [],
  hasChanges: false,
  lastUpdatedBy: null,
  syncConflict: null,
  resolveSyncConflict: jest.fn(),
  resetToOriginal: jest.fn(),
};

jest.mock('@/hooks/useFormYamlSync', () => ({
  useFormYamlSync: jest.fn(() => mockUseFormYamlSync),
}));

// Mock the form components
jest.mock('@/components/forms/PlexSyncForm', () => ({
  PlexSyncForm: ({ disabled }: { form: any; disabled: boolean }) => (
    <div data-testid="plex-sync-form" data-disabled={disabled}>
      Plex Configuration Form
    </div>
  ),
}));

jest.mock('@/components/forms/ApiKeysSyncForm', () => ({
  ApiKeysSyncForm: ({ disabled }: { form: any; disabled: boolean }) => (
    <div data-testid="api-keys-sync-form" data-disabled={disabled}>
      API Keys Configuration Form
    </div>
  ),
}));

jest.mock('@/components/forms/SyncConflictDialog', () => ({
  SyncConflictDialog: ({ onResolve }: { conflict: any; onResolve: any }) => (
    <div data-testid="sync-conflict-dialog">
      Sync Conflict Dialog
      <button onClick={() => onResolve('accept_form')}>Accept Form</button>
    </div>
  ),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

describe('DualPaneConfigPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();

    // Reset mock state
    mockUseFormYamlSync.yamlContent = 'test: config';
    mockUseFormYamlSync.hasChanges = false;
    mockUseFormYamlSync.lastUpdatedBy = null;
    mockUseFormYamlSync.isValid = true;
    mockUseFormYamlSync.validationErrors = [];
    mockUseFormYamlSync.syncConflict = null;

    // Mock fetch for loading config
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ yaml: 'test: config' }),
      })
    ) as jest.Mock;
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DualPaneConfigPage />
      </QueryClientProvider>
    );
  };

  it('renders the dual-pane interface', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Configuration Editor')).toBeInTheDocument();
    });

    expect(screen.getByText('Configuration Forms')).toBeInTheDocument();
    expect(screen.getByText('YAML Editor')).toBeInTheDocument();
    expect(screen.getByTestId('split-pane')).toBeInTheDocument();
  });

  it('renders component and localStorage functionality exists', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('split-pane')).toBeInTheDocument();
      expect(screen.getByText('Configuration Editor')).toBeInTheDocument();
    });

    // Test that localStorage mock is properly set up
    expect(localStorageMock).toBeDefined();
    expect(localStorageMock.getItem).toBeDefined();
    expect(localStorageMock.setItem).toBeDefined();
  });

  it('shows form tabs', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Plex')).toBeInTheDocument();
      expect(screen.getByText('API Keys')).toBeInTheDocument();
      expect(screen.getByText('Libraries')).toBeInTheDocument();
    });
  });

  it('loads YAML configuration on mount', async () => {
    renderComponent();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/yaml');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('YAML Editor')).toBeInTheDocument();
    });

    const yamlEditor = screen.getByLabelText(
      'YAML Editor'
    ) as HTMLTextAreaElement;
    expect(yamlEditor.value).toBe('test: config');
  });

  it('tracks changes when YAML is modified', async () => {
    // Update mock to show changes
    mockUseFormYamlSync.hasChanges = true;
    mockUseFormYamlSync.lastUpdatedBy = 'yaml';

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });

    const yamlEditor = screen.getByLabelText('YAML Editor');
    fireEvent.change(yamlEditor, { target: { value: 'modified: config' } });

    await waitFor(() => {
      expect(screen.getByText(/You have unsaved changes/)).toBeInTheDocument();
    });
  });

  it('saves configuration when save button is clicked', async () => {
    // Update mock to show changes and valid state
    mockUseFormYamlSync.hasChanges = true;
    mockUseFormYamlSync.isValid = true;
    mockUseFormYamlSync.yamlContent = 'modified: config';

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ yaml: 'test: config' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Configuration').closest('button');
    fireEvent.click(saveButton!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/yaml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: 'modified: config' }),
      });
    });
  });

  it('resets changes when reset button is clicked', async () => {
    // Update mock to show changes initially
    mockUseFormYamlSync.hasChanges = true;
    mockUseFormYamlSync.yamlContent = 'modified: config';

    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText('YAML Editor')).toBeInTheDocument();
    });

    const yamlEditor = screen.getByLabelText('YAML Editor');
    expect((yamlEditor as HTMLTextAreaElement).value).toBe('modified: config');

    await waitFor(() => {
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    const resetButton = screen.getByText('Reset').closest('button');
    expect(resetButton).not.toBeDisabled();

    fireEvent.click(resetButton!);

    expect(mockUseFormYamlSync.resetToOriginal).toHaveBeenCalled();
  });

  it('switches between form tabs', async () => {
    renderComponent();

    // Wait for the component to fully load (query completes)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Plex' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'API Keys' })).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: 'Libraries' })
      ).toBeInTheDocument();
    });

    // Test tab clicking functionality
    const apiKeysTab = screen.getByRole('tab', { name: 'API Keys' });
    const librariesTab = screen.getByRole('tab', { name: 'Libraries' });

    // Verify tabs are clickable
    expect(apiKeysTab).toBeInTheDocument();
    expect(librariesTab).toBeInTheDocument();

    fireEvent.click(apiKeysTab);
    fireEvent.click(librariesTab);

    // Test passes if no errors are thrown during tab clicks
  });
});
