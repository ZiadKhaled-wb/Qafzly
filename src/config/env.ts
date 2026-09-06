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
    SENDGRID_API_KEY: z.string().optional(),
    SENDGRID_FROM_EMAIL: z.string().default('noreply@qafzly.com'),
    ACCOUNT_LOCKOUT_THRESHOLD: z.string().default('5'),
    ACCOUNT_LOCKOUT_DURATION_MINUTES: z.string().default('15'),
    FRONTEND_URL: z.string().default('http://localhost:5173'),
    AWS_REGION: z.string().default('eu-central-1'),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
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
    sendgridApiKey: parsed.data.SENDGRID_API_KEY,
    sendgridFromEmail: parsed.data.SENDGRID_FROM_EMAIL,
    accountLockoutThreshold: parseInt(parsed.data.ACCOUNT_LOCKOUT_THRESHOLD, 10),
    accountLockoutDurationMinutes: parseInt(parsed.data.ACCOUNT_LOCKOUT_DURATION_MINUTES, 10),
    frontendUrl: parsed.data.FRONTEND_URL,
    awsRegion: parsed.data.AWS_REGION,
    awsAccessKeyId: parsed.data.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: parsed.data.AWS_SECRET_ACCESS_KEY,
    s3BucketName: parsed.data.S3_BUCKET_NAME,
};