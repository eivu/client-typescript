// Jest configuration for TypeScript with ESM support

/** @type {import("jest").Config} **/
export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true
    }]
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: []
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
