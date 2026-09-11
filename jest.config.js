/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: [
        '**/src/services/__tests__/**/*.test.ts',
        '**/src/middleware/__tests__/**/*.test.ts',
        '**/src/jobs/__tests__/**/*.test.ts',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/src/__tests__/integration/',
    ],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
};