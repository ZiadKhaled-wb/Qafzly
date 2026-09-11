import { Request, Response, NextFunction } from 'express';
import { idempotency } from '../idempotency';
import { redis } from '../../config/redis';
import { AppError } from '../../utils/AppError';
import { logger } from '../../config/logger';

jest.mock('../../config/redis', () => ({
    redis: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
    },
}));

jest.mock('../../config/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

const makeReqRes = (overrides: Record<string, unknown> = {}) => {
    const headers: Record<string, string> = {};
    const req = {
        header: (name: string) => headers[name.toLowerCase()],
        headers,
        user: { userId: 'user-abc' },
        ...overrides,
    } as unknown as Request;

    const jsonMock = jest.fn().mockReturnValue(undefined);
    const res = {
        statusCode: 200,
        status: jest.fn().mockImplementation(function (this: any, code: number) {
            this.statusCode = code;
            return this;
        }),
        json: jsonMock,
    } as unknown as Response;

    const next = jest.fn() as unknown as NextFunction;
    return { req, res, next, headers, jsonMock };
};

/**
 * The middleware is wrapped in asyncHandler, which returns a void function
 * and runs its logic on a detached promise chain. We must let the microtask
 * queue drain before asserting on `next` / Redis side effects.
 *
 * `setImmediate` fires on the next macrotask, after all pending microtasks.
 */
const flushAsync = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('idempotency middleware', () => {
    beforeEach(() => jest.clearAllMocks());

    it('passes through unchanged when no Idempotency-Key header is present', async () => {
        const mw = idempotency();
        const { req, res, next } = makeReqRes();

        mw(req, res, next);
        await flushAsync();

        expect(redis.get).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith();
    });

    it('rejects with 400 when header is required but missing', async () => {
        const mw = idempotency({ required: true });
        const { req, res, next } = makeReqRes();

        mw(req, res, next);
        await flushAsync();

        const err = (next as jest.Mock).mock.calls[0]?.[0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(400);
    });

    it('rejects with 400 when key exceeds 255 characters', async () => {
        const mw = idempotency();
        const { req, res, next, headers } = makeReqRes();
        headers['idempotency-key'] = 'x'.repeat(256);

        mw(req, res, next);
        await flushAsync();

        const err = (next as jest.Mock).mock.calls[0]?.[0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(400);
    });

    it('returns cached response on replay', async () => {
        (redis.get as jest.Mock).mockResolvedValue(
            JSON.stringify({ statusCode: 201, body: { success: true, data: { id: 'cached' } } })
        );
        const mw = idempotency();
        const { req, res, next, headers } = makeReqRes();
        headers['idempotency-key'] = 'abc-123';

        mw(req, res, next);
        await flushAsync();

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'cached' } });
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects concurrent request with 409 when in-flight marker present', async () => {
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify({ __inFlight: true }));
        const mw = idempotency();
        const { req, res, next, headers } = makeReqRes();
        headers['idempotency-key'] = 'abc-123';

        mw(req, res, next);
        await flushAsync();

        const err = (next as jest.Mock).mock.calls[0]?.[0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(409);
    });

    it('reserves the key and hijacks res.json on first request', async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        (redis.set as jest.Mock).mockResolvedValue('OK');

        const mw = idempotency({ ttlSeconds: 3600 });
        const { req, res, next, headers } = makeReqRes();
        headers['idempotency-key'] = 'abc-123';

        mw(req, res, next);
        await flushAsync();

        // 1. Reservation was made with the in-flight marker
        expect(redis.set).toHaveBeenCalledWith(
            'idempotency:user-abc:abc-123',
            JSON.stringify({ __inFlight: true }),
            'EX',
            30,
            'NX'
        );
        expect(next).toHaveBeenCalledWith();

        // 2. Simulate the controller responding with a 201
        res.statusCode = 201;
        (res.json as jest.Mock)({ success: true, data: { id: 'new' } });

        // 3. Final response should have been cached
        expect(redis.set).toHaveBeenLastCalledWith(
            'idempotency:user-abc:abc-123',
            expect.stringContaining('"statusCode":201'),
            'EX',
            3600
        );
    });

    it('clears the in-flight marker on error responses so client can retry', async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        (redis.set as jest.Mock).mockResolvedValue('OK');
        (redis.del as jest.Mock).mockResolvedValue(1);

        const mw = idempotency();
        const { req, res, next, headers } = makeReqRes();
        headers['idempotency-key'] = 'abc-123';

        mw(req, res, next);
        await flushAsync();

        // Simulate error handler responding with a 500
        res.statusCode = 500;
        (res.json as jest.Mock)({ success: false });

        expect(redis.del).toHaveBeenCalledWith('idempotency:user-abc:abc-123');
    });

    it('fails open when Redis GET is unreachable', async () => {
        (redis.get as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
        const mw = idempotency();
        const { req, res, next, headers } = makeReqRes();
        headers['idempotency-key'] = 'abc-123';

        mw(req, res, next);
        await flushAsync();

        expect(next).toHaveBeenCalledWith();
        expect(logger.warn).toHaveBeenCalled();
    });

    it('fails open when Redis SET NX is unreachable', async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        (redis.set as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
        const mw = idempotency();
        const { req, res, next, headers } = makeReqRes();
        headers['idempotency-key'] = 'abc-123';

        mw(req, res, next);
        await flushAsync();

        expect(next).toHaveBeenCalledWith();
        expect(logger.warn).toHaveBeenCalled();
    });

    it('rejects with 409 if the NX reservation fails (race between GET and SET)', async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        (redis.set as jest.Mock).mockResolvedValue(null);  // NX failed — another instance won
        const mw = idempotency();
        const { req, res, next, headers } = makeReqRes();
        headers['idempotency-key'] = 'abc-123';

        mw(req, res, next);
        await flushAsync();

        const err = (next as jest.Mock).mock.calls[0]?.[0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(409);
    });
});