import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

// =============================================================================
// Leveling formula — matches the Student Dashboard spec §3.2
// -----------------------------------------------------------------------------
//   Cumulative XP required to REACH level N:
//     threshold(1) = 0
//     threshold(N) = 50 * N * (N - 1)   for N >= 2
//
//   Level widths (XP earned within the level):
//     L1 = 100, L2 = 200, L3 = 300, L4 = 400, L5 = 500, L6 = 600, ...
//
//   Progress within level N = (totalXp - threshold(N)) / (threshold(N+1) - threshold(N))
// =============================================================================
const xpThresholdForLevel = (level: number): number => {
    if (level <= 1) return 0;
    return 50 * level * (level - 1);
};

const levelFromXp = (totalXp: number): number => {
    let level = 1;
    // Safety cap — real users won't approach this, but protects against bad input.
    while (level < 999 && xpThresholdForLevel(level + 1) <= totalXp) {
        level += 1;
    }
    return level;
};

interface LevelInfo {
    level: number;
    totalXp: number;
    currentLevelXp: number;
    nextLevelXp: number;
}

const computeLevelInfo = (totalXp: number): LevelInfo => {
    const level = levelFromXp(totalXp);
    const currentThreshold = xpThresholdForLevel(level);
    const nextThreshold = xpThresholdForLevel(level + 1);
    return {
        level,
        totalXp,
        currentLevelXp: totalXp - currentThreshold,
        nextLevelXp: nextThreshold - currentThreshold,
    };
};

// =============================================================================
// Profile
// =============================================================================
export const getProfile = async (userId: string) => {
    const stats = await prisma.userStats.findUnique({
        where: { userId },
        include: {
            user: {
                select: { id: true, fullName: true, displayName: true, avatarUrl: true },
            },
        },
    });
    if (!stats) throw new AppError(404, 'بيانات المستخدم غير موجودة');

    const levelInfo = computeLevelInfo(stats.xp);

    const userBadges = await prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
    });

    const rank = await getUserRank(userId, 'global');

    return {
        userId,
        totalXp: levelInfo.totalXp,
        level: levelInfo.level,
        currentLevelXp: levelInfo.currentLevelXp,
        nextLevelXp: levelInfo.nextLevelXp,
        rank,
        badges: userBadges.map((ub) => ({
            id: ub.badge.id,
            nameAr: ub.badge.name,
            nameEn: ub.badge.nameEn ?? ub.badge.name,
            iconUrl: ub.badge.iconUrl,
            earnedAt: ub.earnedAt,
        })),
        // Secondary context (kept for backward compatibility with other clients)
        currentStreak: stats.streak,
        longestStreak: stats.longestStreak,
        totalLessonsCompleted: stats.totalLessonsCompleted,
        totalPathsCompleted: stats.totalPathsCompleted,
    };
};

// =============================================================================
// XP history
// =============================================================================
export const getXpHistory = async (userId: string, page: number, limit: number) => {
    const skip = (page - 1) * limit;
    const where = { userId };
    const [logs, total] = await Promise.all([
        prisma.xpAuditLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.xpAuditLog.count({ where }),
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// =============================================================================
// Level definitions
// =============================================================================
export const getLevels = async () => {
    const levels = [];
    for (let i = 1; i <= 50; i++) {
        const startXp = xpThresholdForLevel(i);
        const endXp = xpThresholdForLevel(i + 1);
        levels.push({
            level: i,
            xpRequired: startXp,          // cumulative to reach this level
            xpToNext: endXp - startXp,    // width of the level
            xpNextLevel: endXp,           // cumulative to reach next level
        });
    }
    return levels;
};

// =============================================================================
// Badges
// =============================================================================
export const getBadges = async () => {
    return prisma.badge.findMany({ orderBy: { createdAt: 'asc' } });
};

export const getUserBadges = async (userId: string) => {
    const badges = await prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
    });
    return badges.map((ub) => ({
        id: ub.badge.id,
        nameAr: ub.badge.name,
        nameEn: ub.badge.nameEn ?? ub.badge.name,
        description: ub.badge.description,
        iconUrl: ub.badge.iconUrl,
        earnedAt: ub.earnedAt,
    }));
};

// =============================================================================
// Leaderboard
// =============================================================================
export const getLeaderboard = async (
    scope: 'global' | 'path',
    pathId?: string,
    page = 1,
    limit = 20
) => {
    const skip = (page - 1) * limit;

    if (scope === 'global') {
        const [stats, total] = await Promise.all([
            prisma.userStats.findMany({
                skip,
                take: limit,
                orderBy: [{ xp: 'desc' }],
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            displayName: true,
                            avatarUrl: true,
                        },
                    },
                },
            }),
            prisma.userStats.count(),
        ]);

        return {
            leaderboard: stats.map((s, idx) => ({
                userId: s.userId,
                fullName: s.user.fullName,
                displayName: s.user.displayName,
                avatarUrl: s.user.avatarUrl,
                totalXp: s.xp,
                level: levelFromXp(s.xp),
                rank: skip + idx + 1,
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    if (scope === 'path' && pathId) {
        const enrollments = await prisma.enrollment.findMany({
            where: { pathId, isActive: true },
            select: { userId: true },
        });
        const userIds = enrollments.map((e) => e.userId);
        if (userIds.length === 0) {
            return { leaderboard: [], total: 0, page, limit, totalPages: 0 };
        }

        const progress = await prisma.lessonProgress.groupBy({
            by: ['userId'],
            where: {
                userId: { in: userIds },
                completed: true,
                lesson: { module: { pathId } },
            },
            _count: { _all: true },
            orderBy: { _count: { userId: 'desc' } },
            skip,
            take: limit,
        });

        const total = await prisma.lessonProgress
            .groupBy({
                by: ['userId'],
                where: {
                    userId: { in: userIds },
                    completed: true,
                    lesson: { module: { pathId } },
                },
            })
            .then((rows) => rows.length);

        const leaderboard = await Promise.all(
            progress.map(async (p, idx) => {
                const user = await prisma.user.findUnique({
                    where: { id: p.userId },
                    select: {
                        id: true,
                        fullName: true,
                        displayName: true,
                        avatarUrl: true,
                    },
                });
                return {
                    userId: p.userId,
                    fullName: user?.fullName ?? '—',
                    displayName: user?.displayName ?? null,
                    avatarUrl: user?.avatarUrl ?? null,
                    completedLessons: p._count._all,
                    rank: skip + idx + 1,
                };
            })
        );

        return {
            leaderboard,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    throw new AppError(400, 'معايير غير صالحة');
};

// =============================================================================
// User rank
// =============================================================================
export const getUserRank = async (
    userId: string,
    scope: 'global' | 'path',
    pathId?: string
) => {
    if (scope === 'global') {
        const stats = await prisma.userStats.findUnique({ where: { userId } });
        if (!stats) throw new AppError(404, 'بيانات المستخدم غير موجودة');
        const higher = await prisma.userStats.count({
            where: {
                OR: [
                    { xp: { gt: stats.xp } },
                    {
                        xp: stats.xp,
                        userId: { lt: userId },
                    }, // deterministic tie-breaker
                ],
            },
        });
        return higher + 1;
    }

    if (scope === 'path' && pathId) {
        const userCompleted = await prisma.lessonProgress.count({
            where: { userId, completed: true, lesson: { module: { pathId } } },
        });

        const allProgress = await prisma.lessonProgress.groupBy({
            by: ['userId'],
            where: { completed: true, lesson: { module: { pathId } } },
            _count: { _all: true },
        });

        const higherCount = allProgress.filter(
            (p) => (p._count?._all ?? 0) > userCompleted
        ).length;
        return higherCount + 1;
    }

    throw new AppError(400, 'معايير غير صالحة');
};

// =============================================================================
// Streak
// =============================================================================
export const getStreak = async (userId: string) => {
    const stats = await prisma.userStats.findUnique({ where: { userId } });
    if (!stats) throw new AppError(404, 'بيانات المستخدم غير موجودة');

    // Derive lastActivityDate from the latest lesson access
    const lastProgress = await prisma.lessonProgress.findFirst({
        where: { userId },
        orderBy: { lastAccessedAt: 'desc' },
        select: { lastAccessedAt: true },
    });

    const lastActivityDate = lastProgress?.lastAccessedAt
        ? lastProgress.lastAccessedAt.toISOString().split('T')[0]
        : null;

    return {
        currentStreak: stats.streak,
        longestStreak: stats.longestStreak,
        streakFreezeAvailable: stats.streakFreezeAvailable,
        lastActivityDate,
        lastStreakFreezeAt: stats.lastStreakFreezeAt,
    };
};

// =============================================================================
// Daily quests
// =============================================================================
export const getDailyQuests = async (userId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const quests = await prisma.quest.findMany({
        where: {
            type: 'daily',
            isActive: true,
            startDate: { lte: tomorrow },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
        include: {
            userQuests: {
                where: { userId },
            },
        },
    });

    return quests.map((q) => ({
        id: q.id,
        titleAr: q.title,
        titleEn: q.titleEn,
        descriptionAr: q.description,
        descriptionEn: q.descriptionEn,
        xpAward: q.xpReward,
        target: q.target,
        progress: q.userQuests[0]?.progress ?? 0,
        completed: q.userQuests[0]?.completed ?? false,
        completedAt: q.userQuests[0]?.completedAt ?? null,
    }));
};

// =============================================================================
// Complete daily quest
// =============================================================================
export const completeDailyQuest = async (userId: string, questId: string) => {
    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest || quest.type !== 'daily' || !quest.isActive) {
        throw new AppError(404, 'المهمة غير موجودة أو غير نشطة');
    }

    const existing = await prisma.userQuest.findUnique({
        where: { userId_questId: { userId, questId } },
    });
    if (existing?.completed) {
        throw new AppError(409, 'المهمة مكتملة بالفعل');
    }

    await prisma.userQuest.upsert({
        where: { userId_questId: { userId, questId } },
        update: {
            completed: true,
            completedAt: new Date(),
            progress: quest.target,
        },
        create: {
            userId,
            questId,
            completed: true,
            completedAt: new Date(),
            progress: quest.target,
        },
    });

    await prisma.$transaction([
        prisma.userStats.upsert({
            where: { userId },
            update: { xp: { increment: quest.xpReward } },
            create: { userId, xp: quest.xpReward },
        }),
        prisma.xpAuditLog.create({
            data: {
                userId,
                amount: quest.xpReward,
                reason: 'daily_quest_complete',
                source: 'quest',
            },
        }),
    ]);

    return { questId, xpAwarded: quest.xpReward };
};

// =============================================================================
// Streak freeze
// =============================================================================
export const freezeStreak = async (userId: string) => {
    const stats = await prisma.userStats.findUnique({ where: { userId } });
    if (!stats) throw new AppError(404, 'بيانات المستخدم غير موجودة');

    if (stats.streakFreezeAvailable <= 0) {
        throw new AppError(400, 'لا يوجد تجميد متاح');
    }

    return prisma.userStats.update({
        where: { userId },
        data: {
            streakFreezeAvailable: { decrement: 1 },
            lastStreakFreezeAt: new Date(),
        },
        select: {
            userId: true,
            streak: true,
            streakFreezeAvailable: true,
            lastStreakFreezeAt: true,
        },
    });
};