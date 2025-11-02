// Jest configuration for TypeScript with ESM support

/** @type {import("jest").Config} **/
export default {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^file-type$': '<rootDir>/node_modules/file-type/index.js',
    '^music-metadata$': '<rootDir>/node_modules/music-metadata/lib/index.js'
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup-matchers.js'],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts'
  ],
  transform: {
    '^.+\\.(ts|js)$': ['ts-jest', {
      tsconfig: {
        moduleResolution: 'node',
        types: ['jest', 'node', 'jest-extended']
      },
      useESM: true
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(music-metadata|strtok3|token-types|file-type|@tokenizer|uint8array-extras|@borewit|p-limit|yocto-queue))'
  ]
}

// module.exports = {
//   testEnvironment: 'node',
//   moduleFileExtensions: ['ts', 'js', 'json'],
//   testMatch: ['<rootDir>/tests/jest/**/*.ts'],
//   transform: {'\\.ts$': 'ts-jest/preprocessor'},
//   coverageReporters: ['lcov', 'text-summary'],
//   // collectCoverage: !!`Boolean(process.env.CI)`,
//   collectCoverageFrom: ['src/**/*.ts'],
//   coveragePathIgnorePatterns: ['/templates/'],
//   coverageThreshold: {
//     global: {
//       branches: 100,
//       functions: 100,
//       lines: 100,
//       statements: 100,
//     },
//   },
// }
