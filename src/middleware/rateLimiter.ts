import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { AppError } from '../utils/AppError';
import { config } from '../config/env';
import { logger } from '../config/logger';

export interface RateLimiterOptions {
    /** Sliding-window length in milliseconds. */
    windowMs: number;
    /** Maximum requests allowed per window per key. */
    max: number;
    /** Redis key namespace, e.g. 'general' or 'auth'. */
    keyPrefix: string;
    /**
     * Builds the bucket key for a request. Defaults to userId-when-authenticated
     * else IP — CGNAT-friendly for the Egyptian mobile market.
     */
    keyGenerator?: (req: Request) => string;
    /**
     * When Redis is unreachable:
     *   true  → log warning, let the request through (fail-open)
     *   false → reject with 503 (fail-closed)
     * Defaults to `config.rateLimitFailOpen`.
     */
    skipOnError?: boolean;
    /** Message returned with 429 responses. */
    message?: string;
}

const defaultKeyGenerator = (req: Request): string => {
    const user = (req as any).user;
    if (user?.userId) return `user:${user.userId}`;
    return `ip:${req.ip || 'unknown'}`;
};

export const createRateLimiter = (options: RateLimiterOptions) => {
    const {
        windowMs,
        max,
        keyPrefix,
        keyGenerator = defaultKeyGenerator,
        skipOnError = config.rateLimitFailOpen,
        message = 'محاولات كثيرة، يرجى المحاولة لاحقاً',
    } = options;

    const windowSeconds = Math.ceil(windowMs / 1000);

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const key = `rate:${keyPrefix}:${keyGenerator(req)}`;

        try {
            const current = await redis.incr(key);

            // First hit in this window → set the TTL
            if (current === 1) {
                await redis.expire(key, windowSeconds);
            }

            const ttl = await redis.ttl(key);
            const resetSeconds = ttl > 0 ? ttl : windowSeconds;

            res.setHeader('X-RateLimit-Limit', String(max));
            res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - current)));
            res.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + resetSeconds));

            if (current > max) {
                res.setHeader('Retry-After', String(resetSeconds));
                return next(new AppError(429, message));
            }

            return next();
        } catch (error) {
            // AppError from our own 429 path — propagate unchanged
            if (error instanceof AppError) {
                return next(error);
            }

            if (skipOnError) {
                logger.warn({ err: error, key }, 'Rate limiter: Redis unavailable — failing open');
                return next();
            }

            logger.error({ err: error, key }, 'Rate limiter: Redis unavailable — failing closed');
            return next(new AppError(503, 'الخدمة غير متوفرة مؤقتاً، يرجى المحاولة لاحقاً'));
        }
    };
};

/**
 * Default rate limiter applied to all /v1 routes.
 * Bucket key: userId if authenticated, else IP.
 * Limits sourced from RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX_REQUESTS.
 */
export const rateLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    keyPrefix: 'general',
});