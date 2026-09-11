import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import {
    expirePaymentRequests,
    runPaymentExpiryJob,
    startPaymentExpiryJob,
    stopPaymentExpiryJob,
} from '../paymentExpiry.job';

jest.mock('../../config/database', () => ({
    prisma: {
        paymentRequest: {
            updateMany: jest.fn(),
        },
    },
}));

jest.mock('../../config/redis', () => ({
    redis: {
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

describe('paymentExpiry.job', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        stopPaymentExpiryJob();
    });

    describe('expirePaymentRequests', () => {
        it('calls updateMany with PENDING + expiresAt < now', async () => {
            (prisma.paymentRequest.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

            const before = new Date();
            const count = await expirePaymentRequests();
            const after = new Date();

            expect(count).toBe(3);

            const call = (prisma.paymentRequest.updateMany as jest.Mock).mock.calls[0][0];
            expect(call.where.status).toBe('PENDING');
            expect(call.where.expiresAt.lt).toBeInstanceOf(Date);
            expect(call.where.expiresAt.lt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(call.where.expiresAt.lt.getTime()).toBeLessThanOrEqual(after.getTime());
            expect(call.data).toEqual({ status: 'EXPIRED' });
        });
    });

    describe('runPaymentExpiryJob', () => {
        it('acquires lock, runs job, releases lock when lock is acquired', async () => {
            (redis.set as jest.Mock).mockResolvedValue('OK');
            (redis.del as jest.Mock).mockResolvedValue(1);
            (prisma.paymentRequest.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

            await runPaymentExpiryJob();

            expect(redis.set).toHaveBeenCalledWith(
                'cron:payment_expiry:lock',
                expect.any(String),
                'EX',
                expect.any(Number),
                'NX'
            );
            expect(prisma.paymentRequest.updateMany).toHaveBeenCalled();
            expect(redis.del).toHaveBeenCalledWith('cron:payment_expiry:lock');
            expect(logger.info).toHaveBeenCalledWith(
                { count: 5 },
                'Payment expiry job: expired payment requests'
            );
        });

        it('skips the job when another instance holds the lock', async () => {
            (redis.set as jest.Mock).mockResolvedValue(null);

            await runPaymentExpiryJob();

            expect(prisma.paymentRequest.updateMany).not.toHaveBeenCalled();
            expect(redis.del).not.toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalled();
        });

        it('runs the job (without lock) when Redis is unavailable — fail-open', async () => {
            (redis.set as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
            (redis.del as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
            (prisma.paymentRequest.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

            await runPaymentExpiryJob();

            expect(prisma.paymentRequest.updateMany).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalled();
            // Attempted to release in finally — also warned
            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({ err: expect.any(Error) }),
                expect.stringContaining('failed to release lock')
            );
        });

        it('swallows DB errors and logs them without throwing', async () => {
            (redis.set as jest.Mock).mockResolvedValue('OK');
            (redis.del as jest.Mock).mockResolvedValue(1);
            (prisma.paymentRequest.updateMany as jest.Mock).mockRejectedValue(
                new Error('DB down')
            );

            await expect(runPaymentExpiryJob()).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ err: expect.any(Error) }),
                'Payment expiry job failed'
            );
        });
    });

    describe('start / stop lifecycle', () => {
        it('is a no-op when called twice', () => {
            startPaymentExpiryJob(60_000);
            startPaymentExpiryJob(60_000);

            expect(logger.warn).toHaveBeenCalledWith(
                'Payment expiry job already started'
            );
        });
    });
});