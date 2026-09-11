import { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '../rateLimiter';
import { redis } from '../../config/redis';
import { AppError } from '../../utils/AppError';
import { logger } from '../../config/logger';

jest.mock('../../config/redis', () => ({
    redis: {
        incr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
    },
}));

jest.mock('../../config/logger', () => ({
    logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../../config/env', () => ({
    config: {
        rateLimitWindowMs: 60000,
        rateLimitMaxRequests: 100,
        rateLimitFailOpen: true,
    },
}));

const makeReqRes = (overrides: Record<string, unknown> = {}) => {
    const req = {
        ip: '127.0.0.1',
        path: '/test',
        headers: {},
        ...overrides,
    } as unknown as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;
    return { req, res, next };
};

describe('createRateLimiter', () => {
    beforeEach(() => jest.clearAllMocks());

    it('allows a request under the limit and sets X-RateLimit headers', async () => {
        (redis.incr as jest.Mock).mockResolvedValue(1);
        (redis.expire as jest.Mock).mockResolvedValue(1);
        (redis.ttl as jest.Mock).mockResolvedValue(59);

        const limiter = createRateLimiter({ windowMs: 60000, max: 100, keyPrefix: 'test' });
        const { req, res, next } = makeReqRes();

        await limiter(req, res, next);

        expect(redis.incr).toHaveBeenCalledWith('rate:test:ip:127.0.0.1');
        expect(redis.expire).toHaveBeenCalledWith('rate:test:ip:127.0.0.1', 60);
        expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
        expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '99');
        expect(next).toHaveBeenCalledWith();
    });

    it('does not reset the TTL once the bucket already exists', async () => {
        (redis.incr as jest.Mock).mockResolvedValue(5);
        (redis.ttl as jest.Mock).mockResolvedValue(30);

        const limiter = createRateLimiter({ windowMs: 60000, max: 100, keyPrefix: 'test' });
        const { req, res, next } = makeReqRes();

        await limiter(req, res, next);

        expect(redis.expire).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith();
    });

    it('returns 429 with Retry-After when the limit is exceeded', async () => {
        (redis.incr as jest.Mock).mockResolvedValue(101);
        (redis.ttl as jest.Mock).mockResolvedValue(30);

        const limiter = createRateLimiter({ windowMs: 60000, max: 100, keyPrefix: 'test' });
        const { req, res, next } = makeReqRes();

        await limiter(req, res, next);

        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30');
        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const err = (next as jest.Mock).mock.calls[0][0] as AppError;
        expect(err.statusCode).toBe(429);
    });

    it('keys by user-id when req.user is populated', async () => {
        (redis.incr as jest.Mock).mockResolvedValue(1);
        (redis.expire as jest.Mock).mockResolvedValue(1);
        (redis.ttl as jest.Mock).mockResolvedValue(59);

        const limiter = createRateLimiter({ windowMs: 60000, max: 100, keyPrefix: 'test' });
        const { req, res, next } = makeReqRes({
            user: { userId: 'user-abc', email: 'x@y.z', role: 'STUDENT' },
        });

        await limiter(req, res, next);

        expect(redis.incr).toHaveBeenCalledWith('rate:test:user:user-abc');
    });

    it('fails open on Redis error when skipOnError=true', async () => {
        (redis.incr as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

        const limiter = createRateLimiter({
            windowMs: 60000, max: 100, keyPrefix: 'test', skipOnError: true,
        });
        const { req, res, next } = makeReqRes();

        await limiter(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(logger.warn).toHaveBeenCalled();
    });

    it('fails closed (503) on Redis error when skipOnError=false', async () => {
        (redis.incr as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

        const limiter = createRateLimiter({
            windowMs: 60000, max: 100, keyPrefix: 'test', skipOnError: false,
        });
        const { req, res, next } = makeReqRes();

        await limiter(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const err = (next as jest.Mock).mock.calls[0][0] as AppError;
        expect(err.statusCode).toBe(503);
        expect(logger.error).toHaveBeenCalled();
    });
});