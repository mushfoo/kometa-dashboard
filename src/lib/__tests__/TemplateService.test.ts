import { TemplateService } from '../TemplateService';
import { FileStorageService } from '../FileStorageService';

// Mock yaml module
jest.mock('yaml', () => ({
  parse: jest.fn((yamlString: string) => {
    if (yamlString.includes('invalid')) {
      throw new Error('Invalid YAML');
    }
    // Simple mock parsing
    if (yamlString.includes('plex:')) {
      return {
        plex: {
          url: yamlString.includes('localhost')
            ? 'http://localhost:32400'
            : 'placeholder',
          token: yamlString.includes('my-token') ? 'my-token' : 'placeholder',
        },
      };
    }
    return {};
  }),
  stringify: jest.fn((obj: any) => {
    if (obj.plex) {
      return `plex:\n  url: ${obj.plex.url}\n  token: ${obj.plex.token}`;
    }
    return 'test: yaml';
  }),
}));

// Mock FileStorageService
jest.mock('../FileStorageService');
const MockedFileStorageService = FileStorageService as jest.MockedClass<
  typeof FileStorageService
>;

describe('TemplateService', () => {
  let templateService: TemplateService;
  let mockRead: jest.MockedFunction<any>;
  let mockWrite: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create proper mocks
    mockRead = jest.fn();
    mockWrite = jest.fn();

    // Mock the FileStorageService constructor to return our mocked methods
    MockedFileStorageService.mockImplementation(
      () =>
        ({
          read: mockRead,
          write: mockWrite,
        }) as any
    );

    templateService = new TemplateService();
  });

  describe('getAllTemplates', () => {
    it('should return default templates when no custom templates exist', async () => {
      mockRead
        .mockRejectedValueOnce(new Error('File not found')) // Built-in templates (defaults to default templates)
        .mockResolvedValueOnce([]); // Custom templates

      const categories = await templateService.getAllTemplates();

      expect(categories).toHaveLength(3);
      expect(categories[0]?.id).toBe('basic');
      expect(categories[1]?.id).toBe('advanced');
      expect(categories[2]?.id).toBe('custom');
      expect(categories[2]?.templates).toHaveLength(0);
    });

    it('should include custom templates when they exist', async () => {
      const customTemplate = {
        id: 'custom-123',
        name: 'My Custom Template',
        description: 'Custom configuration',
        category: 'custom' as const,
        tags: ['custom'],
        version: '1.0.0',
        created: '2023-01-01T00:00:00Z',
        updated: '2023-01-01T00:00:00Z',
        yaml: 'test: yaml',
      };

      mockRead
        .mockRejectedValueOnce(new Error('File not found')) // Built-in templates
        .mockResolvedValueOnce([customTemplate]); // Custom templates

      const categories = await templateService.getAllTemplates();
      const customCategory = categories.find((c) => c.id === 'custom');

      expect(customCategory?.templates).toHaveLength(1);
      expect(customCategory?.templates[0]).toEqual(customTemplate);
    });
  });

  describe('saveCustomTemplate', () => {
    it('should save a new custom template', async () => {
      mockRead.mockResolvedValueOnce([]); // Existing custom templates
      mockWrite.mockResolvedValueOnce(undefined);

      const templateData = {
        name: 'Test Template',
        description: 'Test description',
        category: 'custom' as const,
        tags: ['test'],
        version: '1.0.0',
        yaml: 'test: configuration',
      };

      const savedTemplate =
        await templateService.saveCustomTemplate(templateData);

      expect(savedTemplate.name).toBe(templateData.name);
      expect(savedTemplate.category).toBe('custom');
      expect(savedTemplate.id).toMatch(/^custom-/);
      expect(mockWrite).toHaveBeenCalledWith(
        'templates/custom-templates.json',
        expect.arrayContaining([expect.objectContaining(templateData)])
      );
    });
  });

  describe('applyTemplate', () => {
    it('should apply template without customizations', async () => {
      const template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test',
        category: 'basic' as const,
        tags: [],
        version: '1.0.0',
        created: '2023-01-01T00:00:00Z',
        updated: '2023-01-01T00:00:00Z',
        yaml: 'plex:\n  url: placeholder\n  token: placeholder',
      };

      mockRead
        .mockResolvedValueOnce([template]) // Built-in templates
        .mockResolvedValueOnce([]); // Custom templates

      const result = await templateService.applyTemplate('test-template');

      expect(result).toBe(template.yaml);
    });

    it('should apply template with customizations', async () => {
      const template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test',
        category: 'basic' as const,
        tags: [],
        version: '1.0.0',
        created: '2023-01-01T00:00:00Z',
        updated: '2023-01-01T00:00:00Z',
        yaml: 'plex:\n  url: placeholder\n  token: placeholder',
      };

      mockRead
        .mockResolvedValueOnce([template]) // Built-in templates
        .mockResolvedValueOnce([]); // Custom templates

      const customizations = {
        'plex.url': 'http://localhost:32400',
        'plex.token': 'my-token',
      };

      const result = await templateService.applyTemplate(
        'test-template',
        customizations
      );

      expect(result).toContain('url: http://localhost:32400');
      expect(result).toContain('token: my-token');
    });

    it('should throw error for non-existent template', async () => {
      mockRead
        .mockResolvedValueOnce([]) // Built-in templates
        .mockResolvedValueOnce([]); // Custom templates

      await expect(
        templateService.applyTemplate('non-existent')
      ).rejects.toThrow('Template not found: non-existent');
    });
  });

  describe('validateTemplate', () => {
    it('should validate correct YAML', async () => {
      const validYaml = 'plex:\n  url: http://localhost:32400';

      const result = await templateService.validateTemplate(validYaml);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid YAML', async () => {
      const invalidYaml = 'plex:\n  url: [ invalid yaml';

      const result = await templateService.validateTemplate(invalidYaml);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('generatePreview', () => {
    it('should generate preview for valid configuration', () => {
      const yamlContent = `
plex:
  url: http://localhost:32400
tmdb:
  apikey: test
libraries:
  Movies: {}
  TV Shows: {}
collections:
  Action Movies: {}
  Comedy Movies: {}
  Drama Movies: {}
`;

      const preview = templateService.generatePreview(yamlContent);

      expect(preview?.collections).toBe(3);
      expect(preview?.libraries).toEqual(['Movies', 'TV Shows']);
      expect(preview?.features).toContain('Plex Integration');
      expect(preview?.features).toContain('TMDB API');
    });

    it('should handle invalid YAML gracefully', () => {
      const invalidYaml = 'invalid: [ yaml';

      const preview = templateService.generatePreview(invalidYaml);

      expect(preview).toEqual({});
    });
  });

  describe('deleteCustomTemplate', () => {
    it('should delete existing custom template', async () => {
      const existingTemplate = {
        id: 'custom-123',
        name: 'Test Template',
        description: 'Test',
        category: 'custom' as const,
        tags: [],
        version: '1.0.0',
        created: '2023-01-01T00:00:00Z',
        updated: '2023-01-01T00:00:00Z',
        yaml: 'test: yaml',
      };

      mockRead.mockResolvedValueOnce([existingTemplate]);
      mockWrite.mockResolvedValueOnce(undefined);

      const result = await templateService.deleteCustomTemplate('custom-123');

      expect(result).toBe(true);
      expect(mockWrite).toHaveBeenCalledWith(
        'templates/custom-templates.json',
        []
      );
    });

    it('should return false for non-existent template', async () => {
      mockRead.mockResolvedValueOnce([]);

      const result = await templateService.deleteCustomTemplate('non-existent');

      expect(result).toBe(false);
      expect(mockWrite).not.toHaveBeenCalled();
    });
  });
});
