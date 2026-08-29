const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  preset: 'ts-jest',
  testPathIgnorePatterns: ['node_modules', '.next', '/tests/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/index.{ts,tsx}',
    '!src/test/**/*',
    '!src/**/setup.ts',
    '!src/**/mocks/**/*',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/lib/db$': '<rootDir>/src/test/mocks/db.ts',
    '^@/lib/db/index$': '<rootDir>/src/test/mocks/db.ts',
    '^@/lib/db/schema$': '<rootDir>/src/test/mocks/db-schema.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(better-sqlite3|drizzle-orm)/)',
  ],
  testMatch: [
    '<rootDir>/src/test/**/*.test.ts',
    '<rootDir>/src/test/**/*.test.tsx',
    '<rootDir>/src/test/**/*.spec.ts',
    '<rootDir>/src/test/**/*.spec.tsx',
  ],
}

module.exports = createJestConfig(customJestConfig)