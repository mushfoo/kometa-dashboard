import {
  plexConnectionSchema,
  apiKeysSchema,
  librarySettingsSchema,
  collectionBuilderSchema,
  systemSettingsSchema,
  operationParametersSchema,
  formValidationUtils,
} from '../forms';

describe('Form Schemas', () => {
  describe('plexConnectionSchema', () => {
    it('should validate valid Plex connection data', () => {
      const validData = {
        url: 'http://192.168.1.100:32400',
        token: 'abcdefghij1234567890',
        timeout: 30000,
      };

      const result = plexConnectionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const invalidData = {
        url: 'not-a-url',
        token: 'abcdefghij1234567890',
      };

      const result = plexConnectionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.path).toEqual(['url']);
      }
    });

    it('should reject invalid token length', () => {
      const invalidData = {
        url: 'http://192.168.1.100:32400',
        token: 'short',
      };

      const result = plexConnectionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.path).toEqual(['token']);
        expect(result.error.errors[0]?.message).toContain('20 characters');
      }
    });

    it('should reject non-http/https protocols', () => {
      const invalidData = {
        url: 'ftp://192.168.1.100:32400',
        token: 'abcdefghij1234567890',
      };

      const result = plexConnectionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain(
          'http:// or https://'
        );
      }
    });

    it('should validate timeout range', () => {
      const invalidData = {
        url: 'http://192.168.1.100:32400',
        token: 'abcdefghij1234567890',
        timeout: 1000, // Too low
      };

      const result = plexConnectionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should use default timeout', () => {
      const data = {
        url: 'http://192.168.1.100:32400',
        token: 'abcdefghij1234567890',
      };

      const result = plexConnectionSchema.parse(data);
      expect(result.timeout).toBe(30000);
    });
  });

  describe('apiKeysSchema', () => {
    it('should validate valid API keys', () => {
      const validData = {
        tmdb: 'a1b2c3d4e5f678901234567890123456',
        trakt: {
          clientId:
            'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
          clientSecret:
            'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
        },
        imdb: 'ur12345678',
        anidb: 'A1B2C3D4E5F678901234567890123456',
      };

      const result = apiKeysSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow empty strings for optional fields', () => {
      const validData = {
        tmdb: '',
        trakt: {
          clientId: '',
          clientSecret: '',
        },
        imdb: '',
        anidb: '',
      };

      const result = apiKeysSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid TMDb API key format', () => {
      const invalidData = {
        tmdb: 'invalid-key',
      };

      const result = apiKeysSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.path).toEqual(['tmdb']);
      }
    });

    it('should reject invalid Trakt credentials', () => {
      const invalidData = {
        trakt: {
          clientId: 'too-short',
          clientSecret:
            'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
        },
      };

      const result = apiKeysSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid IMDb user ID', () => {
      const invalidData = {
        imdb: 'invalid-format',
      };

      const result = apiKeysSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('start with "ur"');
      }
    });
  });

  describe('librarySettingsSchema', () => {
    it('should validate valid library settings', () => {
      const validData = {
        libraries: [
          {
            id: 'lib1',
            name: 'Movies',
            type: 'movie' as const,
            enabled: true,
            scanInterval: 24,
            collectionsEnabled: true,
            overlaysEnabled: false,
            metadataUpdates: true,
          },
        ],
        globalSettings: {
          runTime: '06:00',
          timezone: 'America/New_York',
          deleteCollections: false,
          minimumItems: 2,
        },
      };

      const result = librarySettingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const minimalData = {
        libraries: [
          {
            id: 'lib1',
            name: 'Movies',
            type: 'movie' as const,
          },
        ],
        globalSettings: {},
      };

      const result = librarySettingsSchema.parse(minimalData);
      expect(result.libraries[0]?.enabled).toBe(true);
      expect(result.libraries[0]?.scanInterval).toBe(24);
      expect(result.globalSettings.runTime).toBe('06:00');
      expect(result.globalSettings.minimumItems).toBe(2);
    });

    it('should reject invalid time format', () => {
      const invalidData = {
        libraries: [],
        globalSettings: {
          runTime: '25:00', // Invalid hour
        },
      };

      const result = librarySettingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid scan interval', () => {
      const invalidData = {
        libraries: [
          {
            id: 'lib1',
            name: 'Movies',
            type: 'movie' as const,
            scanInterval: 0, // Too low
          },
        ],
        globalSettings: {},
      };

      const result = librarySettingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('collectionBuilderSchema', () => {
    it('should validate valid collection data', () => {
      const validData = {
        name: 'Action Movies',
        description: 'High-octane action films',
        type: 'smart' as const,
        poster: 'https://example.com/poster.jpg',
        sortOrder: 'release.desc' as const,
        visibility: 'visible' as const,
        minimumItems: 5,
        filters: {
          genres: ['Action', 'Adventure'],
          years: {
            min: 2000,
            max: 2023,
          },
          ratings: {
            min: 7.0,
            max: 10.0,
          },
        },
      };

      const result = collectionBuilderSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid collection name', () => {
      const invalidData = {
        name: 'Action<script>alert("xss")</script>',
        type: 'smart' as const,
      };

      const result = collectionBuilderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('invalid characters');
      }
    });

    it('should use default values', () => {
      const minimalData = {
        name: 'Test Collection',
        type: 'smart' as const,
      };

      const result = collectionBuilderSchema.parse(minimalData);
      expect(result.sortOrder).toBe('release.desc');
      expect(result.visibility).toBe('visible');
      expect(result.minimumItems).toBe(1);
    });

    it('should reject empty collection name', () => {
      const invalidData = {
        name: '',
        type: 'smart' as const,
      };

      const result = collectionBuilderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate poster URL', () => {
      const invalidData = {
        name: 'Test Collection',
        type: 'smart' as const,
        poster: 'not-a-url',
      };

      const result = collectionBuilderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('systemSettingsSchema', () => {
    it('should validate valid system settings', () => {
      const validData = {
        theme: 'dark' as const,
        language: 'en' as const,
        dateFormat: 'MM/DD/YYYY' as const,
        timeFormat: '24h' as const,
        timezone: 'America/New_York',
        notifications: {
          enabled: true,
          operationComplete: true,
          operationFailed: true,
          systemAlerts: false,
          weeklyReports: true,
        },
        advanced: {
          logLevel: 'INFO' as const,
          maxLogFiles: 14,
          cacheSize: 1000,
          concurrentOperations: 3,
        },
      };

      const result = systemSettingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const minimalData = {};

      const result = systemSettingsSchema.parse(minimalData);
      expect(result.theme).toBe('system');
      expect(result.language).toBe('en');
      expect(result.notifications.enabled).toBe(true);
      expect(result.advanced.logLevel).toBe('INFO');
    });

    it('should reject invalid cache size', () => {
      const invalidData = {
        advanced: {
          cacheSize: 50, // Too low
        },
      };

      const result = systemSettingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('operationParametersSchema', () => {
    it('should validate valid operation parameters', () => {
      const validData = {
        libraries: ['lib1', 'lib2'],
        operations: {
          metadata: true,
          collections: false,
          overlays: true,
          operations: false,
        },
        options: {
          runImmediately: true,
          ignoreSchedule: false,
          dryRun: true,
          verboseLogging: false,
        },
        schedule: {
          enabled: true,
          time: '06:30',
          days: ['MON', 'WED', 'FRI'] as const,
        },
      };

      const result = operationParametersSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require at least one library', () => {
      const invalidData = {
        libraries: [],
      };

      const result = operationParametersSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain(
          'At least one library'
        );
      }
    });

    it('should use default values', () => {
      const minimalData = {
        libraries: ['lib1'],
      };

      const result = operationParametersSchema.parse(minimalData);
      expect(result.operations.metadata).toBe(true);
      expect(result.operations.collections).toBe(true);
      expect(result.options.runImmediately).toBe(false);
    });

    it('should validate schedule time format', () => {
      const invalidData = {
        libraries: ['lib1'],
        schedule: {
          enabled: true,
          time: '25:00', // Invalid hour
        },
      };

      const result = operationParametersSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('formValidationUtils', () => {
    describe('passwordMatch', () => {
      it('should return true for matching passwords', () => {
        const result = formValidationUtils.passwordMatch(
          'password123',
          'password123'
        );
        expect(result).toBe(true);
      });

      it('should return error message for non-matching passwords', () => {
        const result = formValidationUtils.passwordMatch(
          'password123',
          'different'
        );
        expect(result).toBe('Passwords do not match');
      });
    });

    describe('dateRange', () => {
      it('should return true for valid date range', () => {
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-12-31');
        const result = formValidationUtils.dateRange(startDate, endDate);
        expect(result).toBe(true);
      });

      it('should return error message for invalid date range', () => {
        const startDate = new Date('2023-12-31');
        const endDate = new Date('2023-01-01');
        const result = formValidationUtils.dateRange(startDate, endDate);
        expect(result).toBe('Start date must be before end date');
      });
    });

    describe('sanitizeString', () => {
      it('should remove dangerous characters', () => {
        const input = '<script>alert("xss")</script>';
        const result = formValidationUtils.sanitizeString(input);
        expect(result).toBe('scriptalert(xss)/script');
      });

      it('should trim whitespace', () => {
        const input = '  test string  ';
        const result = formValidationUtils.sanitizeString(input);
        expect(result).toBe('test string');
      });

      it('should handle normal strings', () => {
        const input = 'Normal text with numbers 123';
        const result = formValidationUtils.sanitizeString(input);
        expect(result).toBe('Normal text with numbers 123');
      });
    });

    describe('urlAccessible', () => {
      // Note: This test would require mocking fetch in a real environment
      it('should be a function', () => {
        expect(typeof formValidationUtils.urlAccessible).toBe('function');
      });
    });
  });
});
