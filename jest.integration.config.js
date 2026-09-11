module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src/__tests__/integration'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    setupFiles: ['<rootDir>/src/__tests__/integration/env.setup.ts'],
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/integration/setup.ts'],
    testTimeout: 120000,
    verbose: true,
    maxWorkers: 1,
    detectOpenHandles: true,
    forceExit: false,
};