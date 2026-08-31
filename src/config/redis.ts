import Redis from 'ioredis';
import { config } from './env';

export const redis = new Redis(config.redisUrl);

export const connectRedis = async () => {
    try {
        await redis.ping();
        console.log('✅ Redis connected');
    } catch (error) {
        console.error('❌ Redis connection failed', error);
        process.exit(1);
    }
};