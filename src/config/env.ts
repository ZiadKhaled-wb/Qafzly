import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().default('3000'),
    DATABASE_URL: z.string(),
    REDIS_URL: z.string(),
    JWT_ACCESS_SECRET: z.string(),
    JWT_REFRESH_SECRET: z.string(),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),
    CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
    LOG_LEVEL: z.string().default('debug'),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
    RATE_LIMIT_FAIL_OPEN: z.string().default('true'),

    // Account lockout
    ACCOUNT_LOCKOUT_THRESHOLD: z.string().default('5'),
    ACCOUNT_LOCKOUT_DURATION_MINUTES: z.string().default('15'),

    // Frontend
    FRONTEND_URL: z.string().default('http://localhost:5173'),

    // AWS (shared by SES for email and S3 for PDF storage)
    // Credentials are optional: production uses IAM roles, so these may be absent.
    // For local dev, leaving them empty triggers the email service's short-circuit.
    AWS_REGION: z.string().default('eu-central-1'),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),

    // Amazon SES (email delivery)
    // Must be a verified identity in SES (either a verified email or a verified domain).
    SES_FROM_EMAIL: z.string().default('noreply@qafzly.com'),

    // AWS S3 (PDF storage)
    // NOTE: This name must match the .env variable. The original mismatch (S3_BUCKET_NAME
    // in the schema vs AWS_S3_BUCKET_NAME in .env) caused config.s3BucketName to be
    // silently undefined in every environment — fixed in Task #1.
    AWS_S3_BUCKET_NAME: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const config = {
    env: parsed.data.NODE_ENV,
    port: parseInt(parsed.data.PORT, 10),
    databaseUrl: parsed.data.DATABASE_URL,
    redisUrl: parsed.data.REDIS_URL,
    jwtAccessSecret: parsed.data.JWT_ACCESS_SECRET,
    jwtRefreshSecret: parsed.data.JWT_REFRESH_SECRET,
    jwtAccessExpiry: parsed.data.JWT_ACCESS_EXPIRY,
    jwtRefreshExpiry: parsed.data.JWT_REFRESH_EXPIRY,
    corsAllowedOrigins: parsed.data.CORS_ALLOWED_ORIGINS.split(','),
    logLevel: parsed.data.LOG_LEVEL,

    // Rate limiting
    rateLimitWindowMs: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
    rateLimitMaxRequests: parseInt(parsed.data.RATE_LIMIT_MAX_REQUESTS, 10),
    rateLimitFailOpen: parsed.data.RATE_LIMIT_FAIL_OPEN === 'true',

    // Account lockout
    accountLockoutThreshold: parseInt(parsed.data.ACCOUNT_LOCKOUT_THRESHOLD, 10),
    accountLockoutDurationMinutes: parseInt(parsed.data.ACCOUNT_LOCKOUT_DURATION_MINUTES, 10),

    // Frontend
    frontendUrl: parsed.data.FRONTEND_URL,

    // AWS (shared)
    awsRegion: parsed.data.AWS_REGION,
    awsAccessKeyId: parsed.data.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: parsed.data.AWS_SECRET_ACCESS_KEY,

    // Amazon SES
    sesFromEmail: parsed.data.SES_FROM_EMAIL,

    // AWS S3
    s3BucketName: parsed.data.AWS_S3_BUCKET_NAME,
};