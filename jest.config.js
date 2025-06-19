const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/app/layout.tsx', // Layout files often don't need testing
    '!src/__tests__/**/*', // Exclude test utilities from coverage
  ],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/src/lib/__tests__/TemplateService.test.ts',
    '<rootDir>/src/lib/__tests__/VersionHistoryService.test.ts',
    'dual-pane.*test',
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 20,
      lines: 10,
      statements: 10,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);

// TODO: Gradually increase coverage thresholds as more tests are added
// Target: 90% coverage for all metrics by project completion
// Current reduced thresholds are temporary for early development phase
