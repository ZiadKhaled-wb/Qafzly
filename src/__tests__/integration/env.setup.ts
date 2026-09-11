import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables before any module imports
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test'), override: true });
process.env.NODE_ENV = 'test';