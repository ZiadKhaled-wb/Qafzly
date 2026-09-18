import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import {
    buildWeeklySummaries,
    markDigestSent,
} from '../weeklySummary.service';

jest.mock('../../config/database', () => ({
    prisma: {
        user: { findMany: jest.fn(), update: jest.fn() },
        xpAuditLog: { groupBy: jest.fn() },
        lessonProgress: { groupBy: jest.fn() },
        userStats: { findMany: jest.fn() },
        userBadge: { findMany: jest.fn() },
        certificate: { groupBy: jest.fn() },
        userBossBattleProgress: { groupBy: jest.fn() },
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

const periodStart = new Date('2026-09-12T08:00:00Z');
const periodEnd = new Date('2026-09-19T08:00:00Z');

describe('weeklySummary.service', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        // Persistent defaults — every groupBy / findMany returns empty.
        (prisma.xpAuditLog.groupBy as jest.Mock).mockResolvedValue([]);
        (prisma.lessonProgress.groupBy as jest.Mock).mockResolvedValue([]);
        (prisma.userStats.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.certificate.groupBy as jest.Mock).mockResolvedValue([]);
        (prisma.userBossBattleProgress.groupBy as jest.Mock).mockResolvedValue([]);
    });

    // =====================================================================
    // buildWeeklySummaries — eligibility
    // =====================================================================
    describe('buildWeeklySummaries — eligibility', () => {
        it('returns empty array when there are no eligible users', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

            const result = await buildWeeklySummaries(periodStart, periodEnd);

            expect(result).toEqual([]);
        });

        it('excludes users with emailNotifications === false', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'u1',
                    email: 'a@x.com',
                    fullName: 'A',
                    privacySettings: { emailNotifications: false },
                    lastWeeklySummaryRank: null,
                },
                {
                    id: 'u2',
                    email: 'b@x.com',
                    fullName: 'B',
                    privacySettings: { emailNotifications: true },
                    lastWeeklySummaryRank: null,
                },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 0 },
                { userId: 'u2', streak: 0, longestStreak: 0, xp: 0 },
            ]);

            const result = await buildWeeklySummaries(periodStart, periodEnd);

            expect(result.map((r) => r.userId)).toEqual(['u2']);
        });

        it('includes users with no privacy settings (default = opted in)', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'u1',
                    email: 'a@x.com',
                    fullName: 'A',
                    privacySettings: null,
                    lastWeeklySummaryRank: null,
                },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 0 },
            ]);

            const result = await buildWeeklySummaries(periodStart, periodEnd);

            expect(result).toHaveLength(1);
        });

        it('includes zero-activity users', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'u1',
                    email: 'a@x.com',
                    fullName: 'A',
                    privacySettings: null,
                    lastWeeklySummaryRank: null,
                },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 0 },
            ]);

            const result = await buildWeeklySummaries(periodStart, periodEnd);

            expect(result[0].xpEarned).toBe(0);
            expect(result[0].lessonsCompleted).toBe(0);
        });
    });

    // =====================================================================
    // buildWeeklySummaries — per-user aggregation
    // =====================================================================
    describe('buildWeeklySummaries — aggregation', () => {
        const setupSingleUser = () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'u1',
                    email: 'a@x.com',
                    fullName: 'A',
                    privacySettings: null,
                    lastWeeklySummaryRank: null,
                },
            ]);
        };

        it('sums XP from xpAuditLog for the period', async () => {
            setupSingleUser();
            (prisma.xpAuditLog.groupBy as jest.Mock).mockResolvedValue([
                { userId: 'u1', _sum: { amount: 250 } },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 3, longestStreak: 12, xp: 1500 },
            ]);

            const [summary] = await buildWeeklySummaries(periodStart, periodEnd);

            expect(summary.xpEarned).toBe(250);
        });

        it('counts lesson completions for the period', async () => {
            setupSingleUser();
            (prisma.lessonProgress.groupBy as jest.Mock).mockResolvedValue([
                { userId: 'u1', _count: { _all: 4 } },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 0 },
            ]);

            const [summary] = await buildWeeklySummaries(periodStart, periodEnd);

            expect(summary.lessonsCompleted).toBe(4);
        });

        it('carries streak values from userStats', async () => {
            setupSingleUser();
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 7, longestStreak: 21, xp: 2000 },
            ]);

            const [summary] = await buildWeeklySummaries(periodStart, periodEnd);

            expect(summary.currentStreak).toBe(7);
            expect(summary.longestStreak).toBe(21);
        });

        it('collects badges earned in the period', async () => {
            setupSingleUser();
            (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([
                {
                    userId: 'u1',
                    badge: { name: 'أول درس', nameEn: 'First Lesson', iconUrl: '/x.svg' },
                },
                {
                    userId: 'u1',
                    badge: { name: 'أسطورة المدينة', nameEn: 'City Legend', iconUrl: null },
                },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 0 },
            ]);

            const [summary] = await buildWeeklySummaries(periodStart, periodEnd);

            expect(summary.badgesEarned).toHaveLength(2);
            expect(summary.badgesEarned[0].name).toBe('أول درس');
        });

        it('counts certificates earned in the period', async () => {
            setupSingleUser();
            (prisma.certificate.groupBy as jest.Mock).mockResolvedValue([
                { userId: 'u1', _count: { _all: 1 } },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 0 },
            ]);

            const [summary] = await buildWeeklySummaries(periodStart, periodEnd);

            expect(summary.certificatesEarned).toBe(1);
        });

        it('counts boss battles won in the period', async () => {
            setupSingleUser();
            (prisma.userBossBattleProgress.groupBy as jest.Mock).mockResolvedValue([
                { userId: 'u1', _count: { _all: 2 } },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 0 },
            ]);

            const [summary] = await buildWeeklySummaries(periodStart, periodEnd);

            expect(summary.bossBattlesWon).toBe(2);
        });
    });

    // =====================================================================
    // buildWeeklySummaries — rank and rank change
    // =====================================================================
    describe('buildWeeklySummaries — rank change', () => {
        it('returns null rankChange on a user\'s first-ever digest', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'u1',
                    email: 'a@x.com',
                    fullName: 'A',
                    privacySettings: null,
                    lastWeeklySummaryRank: null,
                },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 100 },
            ]);

            const [summary] = await buildWeeklySummaries(periodStart, periodEnd);

            expect(summary.rankChange).toBeNull();
        });

        it('computes positive rankChange when the user climbed', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'u1',
                    email: 'a@x.com',
                    fullName: 'A',
                    privacySettings: null,
                    lastWeeklySummaryRank: 10, // was #10
                },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 300 },
                { userId: 'u2', streak: 0, longestStreak: 0, xp: 200 },
            ]);

            const [summary] = await buildWeeklySummaries(periodStart, periodEnd);

            // u1 at 300 XP is now #1 → previous 10 - 1 = +9
            expect(summary.rank).toBe(1);
            expect(summary.rankChange).toBe(9);
        });

        it('computes negative rankChange when the user slipped', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'u1',
                    email: 'a@x.com',
                    fullName: 'A',
                    privacySettings: null,
                    lastWeeklySummaryRank: 1,
                },
            ]);
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([
                { userId: 'u2', streak: 0, longestStreak: 0, xp: 500 },
                { userId: 'u1', streak: 0, longestStreak: 0, xp: 100 },
            ]);

            const [summary] = await buildWeeklySummaries(periodStart, periodEnd);

            expect(summary.rank).toBe(2);
            expect(summary.rankChange).toBe(-1);
        });
    });

    // =====================================================================
    // markDigestSent
    // =====================================================================
    describe('markDigestSent', () => {
        it('updates lastWeeklySummaryAt and lastWeeklySummaryRank', async () => {
            (prisma.user.update as jest.Mock).mockResolvedValue({});
            const sentAt = new Date('2026-09-19T08:00:00Z');

            await markDigestSent('u1', 42, sentAt);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'u1' },
                data: {
                    lastWeeklySummaryAt: sentAt,
                    lastWeeklySummaryRank: 42,
                },
            });
        });

        it('swallows DB errors and logs them without throwing', async () => {
            (prisma.user.update as jest.Mock).mockRejectedValue(
                new Error('DB down')
            );

            await expect(
                markDigestSent('u1', 1, new Date())
            ).resolves.toBeUndefined();
            expect(logger.error).toHaveBeenCalled();
        });
    });
});