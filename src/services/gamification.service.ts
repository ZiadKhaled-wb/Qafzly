import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { redis } from '../config/redis';

const LEVEL_XP_FORMULA = (level: number) => level * (level + 1) * 5;

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

    const nextLevelXp = LEVEL_XP_FORMULA(stats.level + 1);
    const currentLevelXp = LEVEL_XP_FORMULA(stats.level);
    const xpInLevel = stats.xp - currentLevelXp;
    const xpToNextLevel = nextLevelXp - currentLevelXp;

    const badges = await prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
    });

    const rank = await getUserRank(userId, 'global');

    return {
        userId,
        level: stats.level,
        xp: stats.xp,
        xpToNextLevel,
        currentStreak: stats.streak,
        longestStreak: stats.longestStreak,
        totalLessonsCompleted: stats.totalLessonsCompleted,
        totalpathsCompleted: stats.totalPathsCompleted,
        badges: badges.map(ub => ({
        id: ub.badge.id,
        nameAr: ub.badge.name,
        nameEn: ub.badge.description, // adjust if needed
        iconUrl: ub.badge.iconUrl,
        earnedAt: ub.earnedAt,
        })),
        rank,
    };
};

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

export const getLevels = async () => {
    // Return level thresholds for first 50 levels
    const levels = [];
    for (let i = 1; i <= 50; i++) {
        const xpRequired = LEVEL_XP_FORMULA(i);
        levels.push({ level: i, xpRequired });
    }
    return levels;
};

export const getBadges = async () => {
    return prisma.badge.findMany({ orderBy: { createdAt: 'asc' } });
};

export const getUserBadges = async (userId: string) => {
    const badges = await prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
    });
    return badges.map(ub => ({
        id: ub.badge.id,
        name: ub.badge.name,
        description: ub.badge.description,
        iconUrl: ub.badge.iconUrl,
        earnedAt: ub.earnedAt,
    }));
};

export const getLeaderboard = async (scope: 'global' | 'path', pathId?: string, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;

    if (scope === 'global') {
        const [stats, total] = await Promise.all([
        prisma.userStats.findMany({
            skip,
            take: limit,
            orderBy: [{ xp: 'desc' }, { level: 'desc' }],
            include: {
            user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
            },
        }),
        prisma.userStats.count(),
        ]);
        return { leaderboard: stats.map((s, idx) => ({ ...s, rank: skip + idx + 1 })), total, page, limit, totalPages: Math.ceil(total / limit) };
    } else if (scope === 'path' && pathId) {
        // path-specific: rank by completed lessons in that path
        const enrollments = await prisma.enrollment.findMany({
        where: { pathId, isActive: true },
        select: { userId: true },
        });
        const userIds = enrollments.map(e => e.userId);
        if (userIds.length === 0) return { leaderboard: [], total: 0, page, limit, totalPages: 0 };

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
        const total = await prisma.lessonProgress.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, completed: true, lesson: { module: { pathId } } },
        }).then(rows => rows.length);

        const leaderboard = await Promise.all(progress.map(async (p, idx) => {
        const user = await prisma.user.findUnique({
            where: { id: p.userId },
            select: { id: true, fullName: true, displayName: true, avatarUrl: true },
        });
        return { userId: p.userId, completedLessons: p._count._all, user, rank: skip + idx + 1 };
        }));

        return { leaderboard, total, page, limit, totalPages: Math.ceil(total / limit) };
    } else {
        throw new AppError(400, 'معايير غير صالحة');
    }
};

export const getUserRank = async (userId: string, scope: 'global' | 'path', pathId?: string) => {
    if (scope === 'global') {
        const stats = await prisma.userStats.findUnique({ where: { userId } });
        if (!stats) throw new AppError(404, 'بيانات المستخدم غير موجودة');
        const higher = await prisma.userStats.count({
            where: {
                OR: [
                    { xp: { gt: stats.xp } },
                    { xp: stats.xp, level: { gt: stats.level } },
                    { xp: stats.xp, level: stats.level, userId: { lt: userId } }, // tie-breaker
                ],
            },
        });
        return higher + 1;
    } else if (scope === 'path' && pathId) {
        // Count completed lessons for the current user
        const userCompleted = await prisma.lessonProgress.count({
            where: { userId, completed: true, lesson: { module: { pathId } } },
        });

        // Fetch all user counts (no `having`, compute rank in JS)
        const allProgress = await prisma.lessonProgress.groupBy({
            by: ['userId'],
            where: { completed: true, lesson: { module: { pathId } } },
            _count: { _all: true },
        });

        const higherCount = allProgress.filter(p => (p._count?._all ?? 0) > userCompleted).length;
        return higherCount + 1;
    } else {
        throw new AppError(400, 'معايير غير صالحة');
    }
};

export const getStreak = async (userId: string) => {
    const stats = await prisma.userStats.findUnique({ where: { userId } });
    if (!stats) throw new AppError(404, 'بيانات المستخدم غير موجودة');
    return {
        currentStreak: stats.streak,
        longestStreak: stats.longestStreak,
        lastStreakFreezeAt: stats.lastStreakFreezeAt,
        streakFreezeAvailable: stats.streakFreezeAvailable,
    };
};

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
        OR: [
            { endDate: null },
            { endDate: { gte: today } },
        ],
        },
        include: {
        userQuests: {
            where: { userId },
        },
        },
    });

    return quests.map(q => ({
        id: q.id,
        title: q.title,
        titleEn: q.titleEn,
        description: q.description,
        xpReward: q.xpReward,
        target: q.target,
        progress: q.userQuests[0]?.progress ?? 0,
        completed: q.userQuests[0]?.completed ?? false,
        completedAt: q.userQuests[0]?.completedAt ?? null,
    }));
};

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

    // In a real implementation, we would check if the user has met the target (e.g., completed N lessons)
    // For now, we'll simply mark as completed and award XP.
    const updated = await prisma.userQuest.upsert({
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

    // Award XP
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

export const freezeStreak = async (userId: string) => {
    const stats = await prisma.userStats.findUnique({ where: { userId } });
    if (!stats) throw new AppError(404, 'بيانات المستخدم غير موجودة');

    if (stats.streakFreezeAvailable <= 0) {
        throw new AppError(400, 'لا يوجد تجميد متاح');
    }

    const updated = await prisma.userStats.update({
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

    return updated;
};