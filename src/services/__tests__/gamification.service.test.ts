import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as gamificationService from '../gamification.service';

// Mock Prisma
jest.mock('../../config/database', () => ({
    prisma: {
        userStats: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),   // <-- add this line
        },
        userBadge: {
        findMany: jest.fn(),
        },
        badge: {
        findMany: jest.fn(),
        },
        xpAuditLog: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        },
        enrollment: {
        findMany: jest.fn(),
        },
        lessonProgress: {
        groupBy: jest.fn(),
        count: jest.fn(),
        },
        user: {
        findUnique: jest.fn(),
        },
        quest: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        },
        userQuest: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

describe('Gamification Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Helper mock data
    const mockStats = {
        userId: 'user-1',
        xp: 100,
        level: 2,
        streak: 3,
        longestStreak: 5,
        totalLessonsCompleted: 10,
        totalPathsCompleted: 1,
        lastStreakFreezeAt: null,
        streakFreezeAvailable: 0,
        updatedAt: new Date(),
        user: { id: 'user-1', fullName: 'Test User', displayName: 'Test', avatarUrl: null },
    };

    const mockBadge = {
        id: 'badge-1',
        name: 'أول درس',
        description: 'Complete first lesson',
        iconUrl: '/badges/first-lesson.svg',
        criteria: { type: 'lesson_complete', count: 1 },
        createdAt: new Date(),
    };

    const mockUserBadge = {
        userId: 'user-1',
        badgeId: 'badge-1',
        earnedAt: new Date(),
        badge: mockBadge,
    };

    describe('getProfile', () => {
        it('should return full profile with badges and rank', async () => {
        (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(mockStats);
        (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([mockUserBadge]);
        (prisma.userStats.count as jest.Mock).mockResolvedValue(0); // rank = 1

        const result = await gamificationService.getProfile('user-1');

        expect(result.userId).toBe('user-1');
        expect(result.level).toBe(2);
        expect(result.xp).toBe(100);
        // level 2 current XP threshold = 2*3*5=30, next level 3 = 3*4*5=60, diff = 30
        expect(result.xpToNextLevel).toBe(30);
        expect(result.currentStreak).toBe(3);
        expect(result.longestStreak).toBe(5);
        expect(result.badges).toHaveLength(1);
        expect(result.badges[0].id).toBe('badge-1');
        expect(result.rank).toBe(1);
        });

        it('should throw 404 if stats not found', async () => {
        (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(gamificationService.getProfile('bad-user')).rejects.toThrow(AppError);
        });
    });

    describe('getXpHistory', () => {
        it('should return paginated XP logs', async () => {
        const mockLogs = [{ id: 'log1', userId: 'user-1', amount: 10, reason: 'test', source: 'test', createdAt: new Date() }];
        (prisma.xpAuditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
        (prisma.xpAuditLog.count as jest.Mock).mockResolvedValue(1);

        const result = await gamificationService.getXpHistory('user-1', 1, 10);

        expect(result.logs).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
        expect(result.totalPages).toBe(1);
        });
    });

    describe('getLevels', () => {
        it('should return 50 levels with correct XP thresholds', async () => {
        const levels = await gamificationService.getLevels();
        expect(levels).toHaveLength(50);
        expect(levels[0]).toEqual({ level: 1, xpRequired: 10 }); // 1*2*5=10
        expect(levels[1]).toEqual({ level: 2, xpRequired: 30 }); // 2*3*5=30
        expect(levels[49]).toEqual({ level: 50, xpRequired: 50 * 51 * 5 }); // 12750
        });
    });

    describe('getBadges', () => {
        it('should return all badges ordered by createdAt asc', async () => {
        const badges = [mockBadge, { ...mockBadge, id: 'badge-2', createdAt: new Date() }];
        (prisma.badge.findMany as jest.Mock).mockResolvedValue(badges);

        const result = await gamificationService.getBadges();
        expect(result).toHaveLength(2);
        expect(prisma.badge.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } });
        });
    });

    describe('getUserBadges', () => {
        it('should return user badges mapped', async () => {
        (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([mockUserBadge]);

        const result = await gamificationService.getUserBadges('user-1');
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: 'badge-1',
            name: 'أول درس',
            description: 'Complete first lesson',
            iconUrl: '/badges/first-lesson.svg',
            earnedAt: mockUserBadge.earnedAt,
        });
        });
    });

    describe('getLeaderboard', () => {
        describe('global scope', () => {
        it('should return global leaderboard with ranks', async () => {
            const stats = [
            { ...mockStats, xp: 500, level: 5, user: { fullName: 'A' } },
            { ...mockStats, xp: 300, level: 3, user: { fullName: 'B' } },
            ];
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue(stats);
            (prisma.userStats.count as jest.Mock).mockResolvedValue(2);

            const result = await gamificationService.getLeaderboard('global', undefined, 1, 10);
            expect(result.leaderboard).toHaveLength(2);
            expect(result.leaderboard[0].rank).toBe(1);
            expect(result.leaderboard[1].rank).toBe(2);
            expect(result.total).toBe(2);
            expect(result.totalPages).toBe(1);
        });

        it('should handle empty leaderboard', async () => {
            (prisma.userStats.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.userStats.count as jest.Mock).mockResolvedValue(0);

            const result = await gamificationService.getLeaderboard('global', undefined, 1, 10);
            expect(result.leaderboard).toHaveLength(0);
            expect(result.total).toBe(0);
        });
        });

        describe('path scope', () => {
        it('should return path-specific leaderboard', async () => {
            const enrollments = [{ userId: 'u1' }, { userId: 'u2' }];
            (prisma.enrollment.findMany as jest.Mock).mockResolvedValue(enrollments);

            const progress = [
            { userId: 'u1', _count: { _all: 5 } },
            { userId: 'u2', _count: { _all: 3 } },
            ];
            (prisma.lessonProgress.groupBy as jest.Mock)
            .mockResolvedValueOnce(progress) // for paginated result
            .mockResolvedValueOnce(progress); // for total

            (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) =>
            Promise.resolve({ id: where.id, fullName: where.id === 'u1' ? 'User1' : 'User2', displayName: null, avatarUrl: null })
            );

            const result = await gamificationService.getLeaderboard('path', 'path-1', 1, 10);

            expect(result.leaderboard).toHaveLength(2);
            expect(result.leaderboard[0].userId).toBe('u1');
            const leaderboard = result.leaderboard as any[];
            expect(leaderboard[0].completedLessons).toBe(5);
            expect(result.leaderboard[0].rank).toBe(1);
            expect(result.leaderboard[1].rank).toBe(2);
            expect(result.total).toBe(2);
        });

        it('should return empty if no enrollments', async () => {
            (prisma.enrollment.findMany as jest.Mock).mockResolvedValue([]);

            const result = await gamificationService.getLeaderboard('path', 'path-1', 1, 10);
            expect(result.leaderboard).toHaveLength(0);
            expect(result.total).toBe(0);
        });
        });

        it('should throw 400 for invalid scope', async () => {
        await expect(gamificationService.getLeaderboard('invalid' as any)).rejects.toThrow(AppError);
        });
    });

    describe('getUserRank', () => {
        describe('global scope', () => {
        it('should return correct rank', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue({ userId: 'user-1', xp: 100, level: 2 });
            (prisma.userStats.count as jest.Mock).mockResolvedValue(3);

            const rank = await gamificationService.getUserRank('user-1', 'global');
            expect(rank).toBe(4);
        });

        it('should throw 404 if stats not found', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(gamificationService.getUserRank('bad-user', 'global')).rejects.toThrow(AppError);
        });
        });

        describe('path scope', () => {
        it('should return rank based on completed lessons', async () => {
            (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(5); // user completed 5 lessons
            const allProgress = [
            { userId: 'u1', _count: { _all: 8 } },
            { userId: 'u2', _count: { _all: 5 } },
            { userId: 'u3', _count: { _all: 3 } },
            ];
            (prisma.lessonProgress.groupBy as jest.Mock).mockResolvedValue(allProgress);

            const rank = await gamificationService.getUserRank('user-1', 'path', 'path-1');
            expect(rank).toBe(2); // one user has 8 > 5
        });

        it('should return rank 1 if no one has more', async () => {
            (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(10);
            (prisma.lessonProgress.groupBy as jest.Mock).mockResolvedValue([
            { userId: 'u1', _count: { _all: 10 } },
            ]);

            const rank = await gamificationService.getUserRank('user-1', 'path', 'path-1');
            expect(rank).toBe(1);
        });
        });

        it('should throw 400 for invalid scope', async () => {
        await expect(gamificationService.getUserRank('user-1', 'invalid' as any)).rejects.toThrow(AppError);
        });
    });

    describe('getStreak', () => {
        it('should return streak info', async () => {
        (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(mockStats);
        const result = await gamificationService.getStreak('user-1');
        expect(result.currentStreak).toBe(3);
        expect(result.longestStreak).toBe(5);
        expect(result.streakFreezeAvailable).toBe(0);
        });

        it('should throw 404 if stats not found', async () => {
        (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(gamificationService.getStreak('bad-user')).rejects.toThrow(AppError);
        });
    });

    describe('getDailyQuests', () => {
        it('should return daily quests with user progress', async () => {
        const quests = [
            {
            id: 'quest-1',
            title: 'أكمل درساً واحداً',
            titleEn: 'Complete 1 lesson',
            description: 'أكمل أي درس اليوم',
            xpReward: 20,
            target: 1,
            type: 'daily',
            startDate: new Date(),
            endDate: new Date(),
            isActive: true,
            userQuests: [{ userId: 'user-1', progress: 1, completed: true, completedAt: new Date() }],
            },
        ];
        (prisma.quest.findMany as jest.Mock).mockResolvedValue(quests);

        const result = await gamificationService.getDailyQuests('user-1');
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id: 'quest-1',
            title: 'أكمل درساً واحداً',
            progress: 1,
            completed: true,
        });
        });

        it('should return empty if no quests', async () => {
        (prisma.quest.findMany as jest.Mock).mockResolvedValue([]);
        const result = await gamificationService.getDailyQuests('user-1');
        expect(result).toHaveLength(0);
        });
    });

    describe('completeDailyQuest', () => {
        const mockQuest = {
        id: 'quest-1',
        type: 'daily',
        isActive: true,
        xpReward: 20,
        target: 1,
        };

        it('should complete quest and award XP', async () => {
        (prisma.quest.findUnique as jest.Mock).mockResolvedValue(mockQuest);
        (prisma.userQuest.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.userQuest.upsert as jest.Mock).mockResolvedValue({ questId: 'quest-1' });
        (prisma.$transaction as jest.Mock).mockImplementation(async (ops: any[]) => {});

        const result = await gamificationService.completeDailyQuest('user-1', 'quest-1');
        expect(result).toEqual({ questId: 'quest-1', xpAwarded: 20 });
        expect(prisma.userQuest.upsert).toHaveBeenCalled();
        expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('should throw 404 if quest not found', async () => {
        (prisma.quest.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(gamificationService.completeDailyQuest('user-1', 'bad-quest')).rejects.toThrow(AppError);
        });

        it('should throw 404 if quest is not daily or inactive', async () => {
        (prisma.quest.findUnique as jest.Mock).mockResolvedValue({ ...mockQuest, type: 'weekly' });
        await expect(gamificationService.completeDailyQuest('user-1', 'quest-1')).rejects.toThrow(AppError);
        });

        it('should throw 409 if already completed', async () => {
        (prisma.quest.findUnique as jest.Mock).mockResolvedValue(mockQuest);
        (prisma.userQuest.findUnique as jest.Mock).mockResolvedValue({ completed: true });
        await expect(gamificationService.completeDailyQuest('user-1', 'quest-1')).rejects.toThrow(AppError);
        });
    });
    describe('freezeStreak', () => {
        it('should consume a freeze and set lastStreakFreezeAt', async () => {
            const mockStats = { userId: 'user-1', streakFreezeAvailable: 2, streak: 5 };
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(mockStats);
            const mockUpdated = {
                userId: 'user-1',
                streak: 5,
                streakFreezeAvailable: 1,
                lastStreakFreezeAt: new Date(),
            };
            (prisma.userStats.update as jest.Mock).mockResolvedValue(mockUpdated);

            const result = await gamificationService.freezeStreak('user-1');
            expect(prisma.userStats.update).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            data: {
                streakFreezeAvailable: { decrement: 1 },
                lastStreakFreezeAt: expect.any(Date),
            },
            select: {
                userId: true,
                streak: true,
                streakFreezeAvailable: true,
                lastStreakFreezeAt: true,
            },
            });
            expect(result.streakFreezeAvailable).toBe(1);
            expect(result.lastStreakFreezeAt).toBeDefined();
        });

        it('should throw 404 if stats not found', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(gamificationService.freezeStreak('bad-user')).rejects.toThrow(AppError);
        });

        it('should throw 400 if no freeze available', async () => {
            const mockStats = { userId: 'user-1', streakFreezeAvailable: 0, streak: 5 };
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(mockStats);
            await expect(gamificationService.freezeStreak('user-1')).rejects.toThrow(AppError);
            // ensure update not called
            expect(prisma.userStats.update).not.toHaveBeenCalled();
        });
        });
});