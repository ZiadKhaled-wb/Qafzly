import app from './app';
import { config } from './config/env';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { logger } from './config/logger';

async function bootstrap() {
    // Connect to dependencies
    await connectDatabase();
    await connectRedis();

    app.listen(config.port, () => {
        logger.info(`🚀 Qafzly API running on port ${config.port} in ${config.env} mode`);
    });
}

bootstrap().catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
});