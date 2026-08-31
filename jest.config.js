module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
    collectCoverageFrom: ['src/services/**/*.ts', 'src/controllers/**/*.ts'],
    coverageDirectory: 'coverage',
    setupFiles: ['<rootDir>/jest.setup.ts'],
};