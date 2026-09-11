import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

const LOCK_KEY = 'cron:payment_expiry:lock';
const LOCK_TTL_SECONDS = 55; // shorter than the interval so a crashed instance's lock expires
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const STARTUP_DELAY_MS = 30 * 1000; // first run 30s after boot

/**
 * Flip PENDING payment requests whose expiresAt has passed to EXPIRED.
 * VERIFIED requests are intentionally left alone — once a user has paid
 * and marked sent, expiration is the platform's problem, not theirs.
 *
 * Idempotent: safe to run concurrently on multiple instances.
 * Returns the number of rows affected.
 */
export const expirePaymentRequests = async (): Promise<number> => {
    const result = await prisma.paymentRequest.updateMany({
        where: {
            status: 'PENDING',
            expiresAt: { lt: new Date() },
        },
        data: {
            status: 'EXPIRED',
        },
    });
    return result.count;
};

/**
 * Try to acquire the cross-instance lock.
 * On Redis error, logs a warning and reports `acquired: true` so the job
 * still runs — updateMany with a status filter is idempotent, so this is
 * safe, and it prevents expired requests from piling up during a Redis blip.
 */
const tryAcquireLock = async (): Promise<boolean> => {
    try {
        const result = await redis.set(
            LOCK_KEY,
            String(process.pid),
            'EX',
            LOCK_TTL_SECONDS,
            'NX'
        );
        return result === 'OK';
    } catch (err) {
        logger.warn({ err }, 'Payment expiry job: Redis unavailable — running without lock');
        return true;
    }
};

const releaseLock = async (): Promise<void> => {
    try {
        await redis.del(LOCK_KEY);
    } catch (err) {
        // Non-fatal — the lock will expire on its own via TTL
        logger.warn({ err }, 'Payment expiry job: failed to release lock (will expire via TTL)');
    }
};

/**
 * One full job cycle: acquire lock → expire → release.
 * Public so it can be unit-tested and invoked manually (e.g. from a script).
 */
export const runPaymentExpiryJob = async (): Promise<void> => {
    let locked = false;
    try {
        locked = await tryAcquireLock();
        if (!locked) {
            logger.debug('Payment expiry job: another instance holds the lock, skipping');
            return;
        }

        const count = await expirePaymentRequests();
        if (count > 0) {
            logger.info({ count }, 'Payment expiry job: expired payment requests');
        } else {
            logger.debug('Payment expiry job: no requests to expire');
        }
    } catch (err) {
        // Swallow — a failed cycle must not crash the process; next interval retries
        logger.error({ err }, 'Payment expiry job failed');
    } finally {
        if (locked) {
            await releaseLock();
        }
    }
};

let intervalHandle: NodeJS.Timeout | null = null;
let startupHandle: NodeJS.Timeout | null = null;

export const startPaymentExpiryJob = (intervalMs: number = DEFAULT_INTERVAL_MS): void => {
    if (intervalHandle || startupHandle) {
        logger.warn('Payment expiry job already started');
        return;
    }

    // First run shortly after boot (don't wait a full interval)
    startupHandle = setTimeout(() => {
        void runPaymentExpiryJob();
        startupHandle = null;
    }, STARTUP_DELAY_MS);
    startupHandle.unref();

    intervalHandle = setInterval(() => {
        void runPaymentExpiryJob();
    }, intervalMs);
    intervalHandle.unref();

    logger.info({ intervalMs }, 'Payment expiry job started');
};

export const stopPaymentExpiryJob = (): void => {
    if (startupHandle) {
        clearTimeout(startupHandle);
        startupHandle = null;
    }
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        logger.info('Payment expiry job stopped');
    }
};