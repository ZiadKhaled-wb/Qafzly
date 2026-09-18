import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import * as emailService from '../../services/email.service';
import * as weeklySummaryService from '../../services/weeklySummary.service';
import {
    isMondayEightAMCairo,
    computeDigestPeriod,
    runWeeklySummaryJob,
    tickWeeklySummary,
    startWeeklySummaryJob,
    stopWeeklySummaryJob,
} from '../weeklySummary.job';

jest.mock('../../config/database', () => ({
    prisma: {
        user: { findFirst: jest.fn(), update: jest.fn() },
        notification: { create: jest.fn() },
    },
}));

jest.mock('../../config/redis', () => ({
    redis: { set: jest.fn(), del: jest.fn() },
}));

jest.mock('../../config/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('../../services/email.service', () => ({
    sendWeeklySummaryEmail: jest.fn(),
}));

jest.mock('../../services/weeklySummary.service', () => ({
    buildWeeklySummaries: jest.fn(),
    markDigestSent: jest.fn(),
}));

const makeSummary = (overrides: Partial<any> = {}) => ({
    userId: 'u1',
    email: 'a@x.com',
    fullName: 'A',
    xpEarned: 100,
    lessonsCompleted: 2,
    currentStreak: 3,
    longestStreak: 10,
    rank: 5,
    rankChange: 2,
    badgesEarned: [],
    certificatesEarned: 0,
    bossBattlesWon: 0,
    ...overrides,
});

describe('weeklySummary.job', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        (redis.set as jest.Mock).mockResolvedValue('OK');
        (redis.del as jest.Mock).mockResolvedValue(1);
        (prisma.notification.create as jest.Mock).mockResolvedValue({});
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        (emailService.sendWeeklySummaryEmail as jest.Mock).mockResolvedValue(
            undefined
        );
        (weeklySummaryService.buildWeeklySummaries as jest.Mock).mockResolvedValue([]);
        (weeklySummaryService.markDigestSent as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        stopWeeklySummaryJob();
    });

    // =====================================================================
    // isMondayEightAMCairo
    // =====================================================================
    describe('isMondayEightAMCairo', () => {
        it('returns true for Monday 08:00 Cairo', () => {
            // 2026-09-21 is a Monday. 08:00 Cairo (UTC+3 in Sep 2026, DST) = 05:00 UTC.
            expect(isMondayEightAMCairo(new Date('2026-09-21T05:00:00Z'))).toBe(true);
        });

        it('returns true for any minute within the 08:00 hour', () => {
            expect(isMondayEightAMCairo(new Date('2026-09-21T05:59:00Z'))).toBe(true);
        });

        it('returns false on Tuesday 08:00 Cairo', () => {
            expect(isMondayEightAMCairo(new Date('2026-09-22T05:00:00Z'))).toBe(false);
        });

        it('returns false on Monday 09:00 Cairo', () => {
            expect(isMondayEightAMCairo(new Date('2026-09-21T06:00:00Z'))).toBe(false);
        });

        it('returns false on Monday 07:00 Cairo', () => {
            expect(isMondayEightAMCairo(new Date('2026-09-21T04:00:00Z'))).toBe(false);
        });
    });

    // =====================================================================
    // computeDigestPeriod
    // =====================================================================
    describe('computeDigestPeriod', () => {
        it('returns a 7-day window ending at `now`', () => {
            const now = new Date('2026-09-21T05:00:00Z');
            const { start, end } = computeDigestPeriod(now);

            expect(end.getTime()).toBe(now.getTime());
            expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
        });
    });

    // =====================================================================
    // runWeeklySummaryJob
    // =====================================================================
    describe('runWeeklySummaryJob', () => {
        it('returns 0 when no eligible users', async () => {
            (weeklySummaryService.buildWeeklySummaries as jest.Mock).mockResolvedValue([]);

            const count = await runWeeklySummaryJob(new Date());

            expect(count).toBe(0);
            expect(prisma.notification.create).not.toHaveBeenCalled();
            expect(emailService.sendWeeklySummaryEmail).not.toHaveBeenCalled();
        });

        it('delivers a notification and email per user', async () => {
            (weeklySummaryService.buildWeeklySummaries as jest.Mock).mockResolvedValue([
                makeSummary({ userId: 'u1' }),
                makeSummary({ userId: 'u2', email: 'b@x.com' }),
            ]);

            const count = await runWeeklySummaryJob(new Date());

            expect(count).toBe(2);
            expect(prisma.notification.create).toHaveBeenCalledTimes(2);
            expect(emailService.sendWeeklySummaryEmail).toHaveBeenCalledTimes(2);
            expect(weeklySummaryService.markDigestSent).toHaveBeenCalledTimes(2);
        });

        it('uses the "quiet week" body when a user has zero activity', async () => {
            (weeklySummaryService.buildWeeklySummaries as jest.Mock).mockResolvedValue([
                makeSummary({
                    xpEarned: 0,
                    lessonsCompleted: 0,
                    currentStreak: 0,
                    rankChange: null,
                }),
            ]);

            await runWeeklySummaryJob(new Date());

            const body = (prisma.notification.create as jest.Mock).mock.calls[0][0]
                .data.body;
            expect(body).toContain('افتقدناك');
        });

        it('continues the batch when a single user fails (allSettled)', async () => {
            (weeklySummaryService.buildWeeklySummaries as jest.Mock).mockResolvedValue([
                makeSummary({ userId: 'u1' }),
                makeSummary({ userId: 'u2', email: 'b@x.com' }),
            ]);
            (emailService.sendWeeklySummaryEmail as jest.Mock)
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('boom'));

            const count = await runWeeklySummaryJob(new Date());

            expect(count).toBe(1); // one succeeded, one failed
            expect(prisma.notification.create).toHaveBeenCalledTimes(2);
        });
    });

    // =====================================================================
    // tickWeeklySummary — timing & dedupe
    // =====================================================================
    describe('tickWeeklySummary', () => {
        it('does nothing when it is not Monday 08:00 Cairo', async () => {
            await tickWeeklySummary(new Date('2026-09-22T05:00:00Z')); // Tuesday

            expect(redis.set).not.toHaveBeenCalled();
            expect(weeklySummaryService.buildWeeklySummaries).not.toHaveBeenCalled();
        });

        it('skips when the last digest was < 6 days ago', async () => {
            const now = new Date('2026-09-21T05:00:00Z'); // Monday 08:00 Cairo
            const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({
                lastWeeklySummaryAt: twoDaysAgo,
            });

            await tickWeeklySummary(now);

            expect(redis.set).not.toHaveBeenCalled();
        });

        it('runs when the last digest was > 6 days ago', async () => {
            const now = new Date('2026-09-21T05:00:00Z');
            const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({
                lastWeeklySummaryAt: eightDaysAgo,
            });

            await tickWeeklySummary(now);

            expect(redis.set).toHaveBeenCalledWith(
                'cron:weekly_summary:lock',
                expect.any(String),
                'EX',
                expect.any(Number),
                'NX'
            );
        });

        it('runs when no user has ever received a digest', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

            await tickWeeklySummary(new Date('2026-09-21T05:00:00Z'));

            expect(redis.set).toHaveBeenCalled();
        });

        it('skips when another instance holds the lock', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            (redis.set as jest.Mock).mockResolvedValue(null);

            await tickWeeklySummary(new Date('2026-09-21T05:00:00Z'));

            expect(weeklySummaryService.buildWeeklySummaries).not.toHaveBeenCalled();
            expect(redis.del).not.toHaveBeenCalled();
        });

        it('runs without lock when Redis is unavailable (fail-open)', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            (redis.set as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
            (redis.del as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
            (weeklySummaryService.buildWeeklySummaries as jest.Mock).mockResolvedValue([]);

            await tickWeeklySummary(new Date('2026-09-21T05:00:00Z'));

            expect(logger.warn).toHaveBeenCalled();
            expect(weeklySummaryService.buildWeeklySummaries).toHaveBeenCalled();
        });

        it('swallows errors and logs them without throwing', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            (weeklySummaryService.buildWeeklySummaries as jest.Mock).mockRejectedValue(
                new Error('DB down')
            );

            await expect(
                tickWeeklySummary(new Date('2026-09-21T05:00:00Z'))
            ).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ err: expect.any(Error) }),
                'Weekly summary job failed'
            );
        });
    });

    // =====================================================================
    // start / stop lifecycle
    // =====================================================================
    describe('start / stop lifecycle', () => {
        it('is a no-op when started twice', () => {
            startWeeklySummaryJob(60_000);
            startWeeklySummaryJob(60_000);

            expect(logger.warn).toHaveBeenCalledWith(
                'Weekly summary job already started'
            );
        });
    });
});