import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { asyncHandler } from '../utils/asyncHandler';

const IN_FLIGHT_TTL_SECONDS = 30;
const DEFAULT_CACHE_TTL_SECONDS = 24 * 60 * 60;
const MAX_KEY_LENGTH = 255;

export interface IdempotencyOptions {
    /**
     * How long the cached response is served for repeated requests.
     * Defaults to 24 hours (matches Stripe's convention).
     */
    ttlSeconds?: number;
    /**
     * If true, requests without an Idempotency-Key header are rejected with 400.
     * Defaults to false (backward-compatible).
     */
    required?: boolean;
}

/**
 * Idempotency-Key middleware.
 *
 * Contract:
 *   - Client sends a unique `Idempotency-Key` header per logical operation.
 *   - First request: processed normally, response cached for `ttlSeconds`.
 *   - Subsequent requests with the same key (same user): cached response returned.
 *   - Concurrent requests with the same key: second one gets 409 until first finishes.
 *   - Only 2xx responses are cached. Errors are not — clients can safely retry.
 *   - If Redis is unreachable: fail-open (process normally, no caching). Consistent
 *     with the rate limiter decision — a Redis blip must not break payments.
 */
export const idempotency = (options: IdempotencyOptions = {}) => {
    const ttlSeconds = options.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
    const required = options.required ?? false;

    return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const key = req.header('Idempotency-Key');

        if (!key) {
            if (required) {
                throw new AppError(400, 'رأس Idempotency-Key مطلوب لهذا الطلب');
            }
            return next();
        }

        if (key.length > MAX_KEY_LENGTH) {
            throw new AppError(
                400,
                `مفتاح Idempotency-Key يجب أن يكون ${MAX_KEY_LENGTH} حرفاً أو أقل`
            );
        }

        const userId = (req as any).user?.userId ?? 'anon';
        const cacheKey = `idempotency:${userId}:${key}`;

        let cached: string | null;
        try {
            cached = await redis.get(cacheKey);
        } catch (err) {
            logger.warn({ err, cacheKey }, 'Idempotency: Redis GET failed — failing open');
            return next();
        }

        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                // In-flight marker — another request with the same key is processing
                if (parsed.__inFlight) {
                    throw new AppError(
                        409,
                        'طلب بنفس Idempotency-Key قيد المعالجة حالياً، يرجى الانتظار قليلاً'
                    );
                }
                // Cached real response — replay it
                logger.debug({ cacheKey }, 'Idempotency: returning cached response');
                return res.status(parsed.statusCode).json(parsed.body);
            } catch (err) {
                if (err instanceof AppError) throw err;
                // Corrupted cache entry — fall through and reprocess
                logger.warn({ err, cacheKey }, 'Idempotency: corrupted cache entry, reprocessing');
            }
        }

        // Reserve the key with an in-flight marker
        let reserved: string | null;
        try {
            reserved = await redis.set(
                cacheKey,
                JSON.stringify({ __inFlight: true }),
                'EX',
                IN_FLIGHT_TTL_SECONDS,
                'NX'
            );
        } catch (err) {
            logger.warn({ err, cacheKey }, 'Idempotency: Redis SET NX failed — failing open');
            return next();
        }

        if (reserved !== 'OK') {
            // Lost the race — another instance reserved between our GET and SET
            throw new AppError(
                409,
                'طلب بنفس Idempotency-Key قيد المعالجة حالياً، يرجى الانتظار قليلاً'
            );
        }

        // Hijack res.json so we can persist the final response before it's sent
        const originalJson = res.json.bind(res);
        res.json = function (body: any) {
            const statusCode = res.statusCode;

            if (statusCode >= 200 && statusCode < 300) {
                redis
                    .set(cacheKey, JSON.stringify({ statusCode, body }), 'EX', ttlSeconds)
                    .catch((err) =>
                        logger.error({ err, cacheKey }, 'Idempotency: failed to cache response')
                    );
            } else {
                // Do not cache errors — release the in-flight marker so the client can retry
                redis.del(cacheKey).catch(() => undefined);
            }

            return originalJson(body);
        };

        return next();
    });
};