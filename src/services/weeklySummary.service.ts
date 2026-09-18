import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Per-user weekly digest payload.
 * `rankChange` is null on a user's first-ever digest (nothing to compare to).
 */
export interface UserWeeklySummary {
    userId: string;
    email: string;
    fullName: string;
    xpEarned: number;
    lessonsCompleted: number;
    currentStreak: number;
    longestStreak: number;
    rank: number;
    rankChange: number | null;
    badgesEarned: Array<{ name: string; nameEn: string | null; iconUrl: string | null }>;
    certificatesEarned: number;
    bossBattlesWon: number;
}

/**
 * Computes the digest payloads for every eligible student in one batch.
 *
 * Eligibility:
 *   - role === STUDENT
 *   - isActive === true, deletedAt === null
 *   - privacySettings.emailNotifications !== false
 *
 * Batch design: one query per data source, joined in memory. This keeps the
 * job O(1) in DB round-trips regardless of user count, which matters when
 * this fires against a real population rather than the seed.
 *
 * Period is [periodStart, periodEnd). Caller passes explicit boundaries so
 * this is trivially testable with fixed fixtures.
 */
export const buildWeeklySummaries = async (
    periodStart: Date,
    periodEnd: Date
): Promise<UserWeeklySummary[]> => {
    // 1. Eligible users — single query.
    const users = await prisma.user.findMany({
        where: {
            role: 'STUDENT',
            isActive: true,
            deletedAt: null,
        },
        select: {
            id: true,
            email: true,
            fullName: true,
            privacySettings: true,
            lastWeeklySummaryRank: true,
        },
    });

    // 2. Filter out users who explicitly opted out.
    const eligible = users.filter((u) => {
        const p = u.privacySettings as { emailNotifications?: boolean } | null;
        return !(p && p.emailNotifications === false);
    });

    if (eligible.length === 0) return [];

    const ids = eligible.map((u) => u.id);

    // 3. Batch aggregates — one query each, run in parallel.
    const [
        xpRows,
        lessonRows,
        statsRows,
        badgeRows,
        certRows,
        battleRows,
        leaderboardRows,
    ] = await Promise.all([
        prisma.xpAuditLog.groupBy({
            by: ['userId'],
            where: {
                userId: { in: ids },
                createdAt: { gte: periodStart, lt: periodEnd },
            },
            _sum: { amount: true },
        }),
        prisma.lessonProgress.groupBy({
            by: ['userId'],
            where: {
                userId: { in: ids },
                completedAt: { gte: periodStart, lt: periodEnd },
            },
            _count: { _all: true },
        }),
        prisma.userStats.findMany({
            where: { userId: { in: ids } },
            select: { userId: true, streak: true, longestStreak: true, xp: true },
        }),
        prisma.userBadge.findMany({
            where: {
                userId: { in: ids },
                earnedAt: { gte: periodStart, lt: periodEnd },
            },
            select: {
                userId: true,
                badge: { select: { name: true, nameEn: true, iconUrl: true } },
            },
        }),
        prisma.certificate.groupBy({
            by: ['userId'],
            where: {
                userId: { in: ids },
                issuedAt: { gte: periodStart, lt: periodEnd },
            },
            _count: { _all: true },
        }),
        prisma.userBossBattleProgress.groupBy({
            by: ['userId'],
            where: {
                userId: { in: ids },
                completedAt: { gte: periodStart, lt: periodEnd },
            },
            _count: { _all: true },
        }),
        // Leaderboard snapshot for rank computation — same eligibility filter
        // so ranks match what /gamification/leaderboard returns.
        prisma.userStats.findMany({
            where: {
                user: { isActive: true, deletedAt: null, role: 'STUDENT' },
            },
            select: { userId: true, xp: true },
            orderBy: [{ xp: 'desc' }, { userId: 'asc' }],
        }),
    ]);

    // 4. Index everything by userId for O(1) joins.
    const xpByUser = new Map(xpRows.map((r) => [r.userId, r._sum.amount ?? 0]));
    const lessonsByUser = new Map(lessonRows.map((r) => [r.userId, r._count._all]));
    const statsByUser = new Map(statsRows.map((r) => [r.userId, r]));
    const certsByUser = new Map(certRows.map((r) => [r.userId, r._count._all]));
    const battlesByUser = new Map(battleRows.map((r) => [r.userId, r._count._all]));
    const rankByUser = new Map(
        leaderboardRows.map((r, i) => [r.userId, i + 1] as const)
    );

    const badgesByUser = new Map<
        string,
        Array<{ name: string; nameEn: string | null; iconUrl: string | null }>
    >();
    for (const row of badgeRows) {
        const list = badgesByUser.get(row.userId) ?? [];
        list.push(row.badge);
        badgesByUser.set(row.userId, list);
    }

    // 5. Assemble one digest per eligible user.
    return eligible.map((u) => {
        const stats = statsByUser.get(u.id);
        const currentRank = rankByUser.get(u.id) ?? 0;
        const previousRank = u.lastWeeklySummaryRank ?? null;

        return {
            userId: u.id,
            email: u.email,
            fullName: u.fullName,
            xpEarned: xpByUser.get(u.id) ?? 0,
            lessonsCompleted: lessonsByUser.get(u.id) ?? 0,
            currentStreak: stats?.streak ?? 0,
            longestStreak: stats?.longestStreak ?? 0,
            rank: currentRank,
            rankChange:
                previousRank === null ? null : previousRank - currentRank,
            badgesEarned: badgesByUser.get(u.id) ?? [],
            certificatesEarned: certsByUser.get(u.id) ?? 0,
            bossBattlesWon: battlesByUser.get(u.id) ?? 0,
        };
    });
};

/**
 * Marks a user's digest as sent, storing the rank they held at send time
 * so next week's digest can compute an accurate delta.
 * Non-blocking — failure to persist must not block the email send.
 */
export const markDigestSent = async (
    userId: string,
    rank: number,
    sentAt: Date
): Promise<void> => {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                lastWeeklySummaryAt: sentAt,
                lastWeeklySummaryRank: rank,
            },
        });
    } catch (err) {
        // Non-blocking: a failed bookkeeping write only means next week's
        // rankChange is stale for this user, never that the digest failed.
        logger.error(
            { err, userId },
            'Weekly summary: failed to record lastWeeklySummaryAt'
        );
    }
};