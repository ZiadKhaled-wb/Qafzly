import http from 'http';
import app from './app';
import { config } from './config/env';
import { connectDatabase, prisma } from './config/database';
import { connectRedis, redis } from './config/redis';
import { logger } from './config/logger';
import { startPaymentExpiryJob, stopPaymentExpiryJob } from './jobs/paymentExpiry.job';

const SHUTDOWN_TIMEOUT_MS = 15_000;

async function bootstrap() {
    await connectDatabase();
    await connectRedis();

    const server = http.createServer(app);

    server.listen(config.port, () => {
        logger.info(`🚀 Qafzly API running on port ${config.port} in ${config.env} mode`);
    });

    // Background jobs
    startPaymentExpiryJob();

    // ---------- Graceful shutdown ----------
    let shuttingDown = false;

    const shutdown = async (signal: string): Promise<void> => {
        if (shuttingDown) {
            logger.warn({ signal }, 'Shutdown already in progress — ignoring repeat signal');
            return;
        }
        shuttingDown = true;
        logger.info({ signal }, 'Shutdown initiated');

        // Hard exit if drain takes too long
        const forceExit = setTimeout(() => {
            logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Shutdown timed out — forcing exit');
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        forceExit.unref();

        // 1. Stop background jobs first (no new work enqueued)
        stopPaymentExpiryJob();

        // 2. Stop accepting new HTTP connections; wait for in-flight requests
        await new Promise<void>((resolve) => {
            server.close((err) => {
                if (err) {
                    logger.error({ err }, 'Error closing HTTP server');
                } else {
                    logger.info('HTTP server closed');
                }
                resolve();
            });
        });

        // 3. Close data-layer connections
        try {
            await prisma.$disconnect();
            logger.info('Prisma disconnected');
        } catch (err) {
            logger.error({ err }, 'Error disconnecting Prisma');
        }

        try {
            await redis.quit();
            logger.info('Redis disconnected');
        } catch (err) {
            logger.error({ err }, 'Error disconnecting Redis');
        }

        clearTimeout(forceExit);
        logger.info('Shutdown complete');
        process.exit(0);
    };

    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
    process.on('SIGINT', () => { void shutdown('SIGINT'); });

    process.on('unhandledRejection', (reason) => {
        logger.error({ reason }, 'Unhandled promise rejection');
    });

    process.on('uncaughtException', (err) => {
        logger.fatal({ err }, 'Uncaught exception — initiating shutdown');
        void shutdown('uncaughtException');
    });
}

bootstrap().catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
});