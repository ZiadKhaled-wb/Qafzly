import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { config } from './config/env';
import { prisma } from './config/database';
import { redis } from './config/redis';

const app = express();

// ----- Security -----
app.use(helmet());
app.use(cors({
    origin: config.corsAllowedOrigins,
    credentials: true,
}));

// ----- Logging -----
app.use(morgan('combined'));

// ----- Body parsing -----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----- Health checks (BEFORE the rate limiter) -----
// Liveness: process is alive. Cheap, no dependencies.
app.get('/health/live', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Backwards-compatible alias for old clients
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness: dependencies reachable. 200 = ready to serve, 503 = not ready.
app.get('/health/ready', async (req, res) => {
    const checks: Record<string, 'ok' | 'fail'> = {};
    let allOk = true;

    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = 'ok';
    } catch {
        checks.database = 'fail';
        allOk = false;
    }

    try {
        await redis.ping();
        checks.redis = 'ok';
    } catch {
        checks.redis = 'fail';
        allOk = false;
    }

    res.status(allOk ? 200 : 503).json({
        status: allOk ? 'ok' : 'degraded',
        checks,
        timestamp: new Date().toISOString(),
    });
});

// ----- Swagger UI (dev convenience, unauthenticated, not rate-limited) -----
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ----- Static uploads (pre-S3) -----
// NOTE: delete this line when S3 avatar migration lands.
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ----- Rate limiting — applies to everything below -----
app.use(rateLimiter);

// ----- API v1 -----
app.use('/v1', routes);

// ----- Error handler (must be last) -----
app.use(errorHandler);

export default app;