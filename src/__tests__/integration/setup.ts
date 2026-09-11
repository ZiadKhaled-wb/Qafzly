import { execSync } from 'child_process';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';

// Increase Jest timeout for this setup file
jest.setTimeout(120000);

// Helper to execute each SQL statement separately
async function executeRawStatements(statements: string[]) {
    for (const stmt of statements) {
        await prisma.$executeRawUnsafe(stmt);
    }
}

beforeAll(async () => {
    try {
        execSync('npx prisma migrate deploy', {
            env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
            stdio: 'inherit',
        });
        console.log('Running seed...');
        execSync('npx ts-node prisma/seed.ts', {
            env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
            stdio: 'inherit',
        });
        console.log('Ensuring search vector columns and indexes...');
        const sqlStatements = [
            `ALTER TABLE "paths" ADD COLUMN IF NOT EXISTS "search_vector_ar" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('arabic', coalesce("title", '')), 'A') || setweight(to_tsvector('arabic', coalesce("description", '')), 'B')) STORED`,
            `ALTER TABLE "paths" ADD COLUMN IF NOT EXISTS "search_vector_en" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("titleEn", '')), 'A') || setweight(to_tsvector('english', coalesce("descriptionEn", '')), 'B')) STORED`,
            `CREATE INDEX IF NOT EXISTS "idx_paths_search_ar" ON "paths" USING GIN ("search_vector_ar")`,
            `CREATE INDEX IF NOT EXISTS "idx_paths_search_en" ON "paths" USING GIN ("search_vector_en")`,
            `CREATE INDEX IF NOT EXISTS "idx_paths_title_trgm" ON "paths" USING GIN ("title" gin_trgm_ops)`,
        ];
        await executeRawStatements(sqlStatements);
        console.log('Setup completed successfully.');
    } catch (error) {
        console.error('Setup failed', error);
        throw error;
    }
});

afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
});