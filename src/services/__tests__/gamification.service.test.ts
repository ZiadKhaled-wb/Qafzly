import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as gamificationService from '../gamification.service';

jest.mock('../../config/database', () => ({
    prisma: {
        userStats: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
        },
        userBadge: { findMany: jest.fn() },
        badge: { findMany: jest.fn() },
        xpAuditLog: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
        enrollment: { findMany: jest.fn() },
        lessonProgress: { groupBy: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
        user: { findUnique: jest.fn() },
        quest: { findMany: jest.fn(), findUnique: jest.fn() },
        userQuest: { findUnique: jest.fn(), upsert: jest.fn() },
        $transaction: jest.fn(),
    },
}));

describe('Gamification Service', () => {
    beforeEach(() => jest.clearAllMocks());

    const mockStats = {
        userId: 'user-1',
        xp: 150,                 // → level 2 (threshold 100), currentLevelXp 50, nextLevelXp 200
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
        nameEn: 'First Lesson',
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

    // =========================================================================
    describe('getProfile', () => {
        it('returns frontend-shaped profile with computed level fields', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(mockStats);
            (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([mockUserBadge]);
            (prisma.userStats.count as jest.Mock).mockResolvedValue(0);

            const result = await gamificationService.getProfile('user-1');

            expect(result.userId).toBe('user-1');
            expect(result.totalXp).toBe(150);
            expect(result.level).toBe(2);
            expect(result.currentLevelXp).toBe(50);  // 150 - threshold(2)=100
            expect(result.nextLevelXp).toBe(200);    // threshold(3)=300 - threshold(2)=100
            expect(result.rank).toBe(1);
            expect(result.badges).toHaveLength(1);
            expect(result.badges[0]).toMatchObject({
                id: 'badge-1',
                nameAr: 'أول درس',
                nameEn: 'First Lesson',
                iconUrl: '/badges/first-lesson.svg',
            });
        });

        it('computes level 5 for 1250 XP (frontend example)', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue({
                ...mockStats,
                xp: 1250,
            });
            (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.userStats.count as jest.Mock).mockResolvedValue(0);

            const result = await gamificationService.getProfile('user-1');

            expect(result.level).toBe(5);
            expect(result.currentLevelXp).toBe(250); // 1250 - threshold(5)=1000
            expect(result.nextLevelXp).toBe(500);    // threshold(6)=1500 - threshold(5)=1000
        });

        it('starts new users at level 1 with 0 XP', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue({
                ...mockStats,
                xp: 0,
            });
            (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.userStats.count as jest.Mock).mockResolvedValue(0);

            const result = await gamificationService.getProfile('user-1');

            expect(result.level).toBe(1);
            expect(result.currentLevelXp).toBe(0);
            expect(result.nextLevelXp).toBe(100); // threshold(2)=100 - 0
        });

        it('throws 404 if stats not found', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(gamificationService.getProfile('bad')).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('getXpHistory', () => {
        it('returns paginated XP logs', async () => {
            (prisma.xpAuditLog.findMany as jest.Mock).mockResolvedValue([
                { id: 'log1', userId: 'user-1', amount: 10, reason: 'test', source: 'test', createdAt: new Date() },
            ]);
            (prisma.xpAuditLog.count as jest.Mock).mockResolvedValue(1);

            const result = await gamificationService.getXpHistory('user-1', 1, 10);
            expect(result.logs).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    // =========================================================================
    describe('getLevels', () => {
        it('returns 50 levels using the frontend formula', async () => {
            const levels = await gamificationService.getLevels();
            expect(levels).toHaveLength(50);
            expect(levels[0]).toEqual({
                level: 1,
                xpRequired: 0,
                xpToNext: 100,
                xpNextLevel: 100,
            });
            expect(levels[1]).toEqual({
                level: 2,
                xpRequired: 100,
                xpToNext: 200,
                xpNextLevel: 300,
            });
            expect(levels[4]).toEqual({
                level: 5,
                xpRequired: 1000,
                xpToNext: 500,
                xpNextLevel: 1500,
            });
        });
    });

    // =========================================================================
    describe('getBadges', () => {
        it('returns all badges ordered by createdAt asc', async () => {
            const badges = [mockBadge, { ...mockBadge, id: 'badge-2', createdAt: new Date() }];
            (prisma.badge.findMany as jest.Mock).mockResolvedValue(badges);
            const result = await gamificationService.getBadges();
            expect(result).toHaveLength(2);
            expect(prisma.badge.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } });
        });
    });

    // =========================================================================
    describe('getUserBadges', () => {
        it('returns user badges with nameAr and nameEn', async () => {
            (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([mockUserBadge]);
            const result = await gamificationService.getUserBadges('user-1');
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'badge-1',
                nameAr: 'أول درس',
                nameEn: 'First Lesson',
                iconUrl: '/badges/first-lesson.svg',
            });
        });

        it('falls back to Arabic name when nameEn is null', async () => {
            (prisma.userBadge.findMany as jest.Mock).mockResolvedValue([
                { ...mockUserBadge, badge: { ...mockBadge, nameEn: null } },
            ]);
            const result = await gamificationService.getUserBadges('user-1');
            expect(result[0].nameEn).toBe('أول درس');
        });
    });

    // =========================================================================
    describe('getLeaderboard', () => {
                describe('global scope', () => {
            it('returns entries with userId, fullName, totalXp, level, rank', async () => {
                const stats = [
                    { userId: 'u1', xp: 2500, user: { id: 'u1', fullName: 'يوسف', displayName: null, avatarUrl: null } },
                    { userId: 'u2', xp: 1250, user: { id: 'u2', fullName: 'مريم', displayName: null, avatarUrl: null } },
                ];
                (prisma.userStats.findMany as jest.Mock).mockResolvedValue(stats);
                (prisma.userStats.count as jest.Mock).mockResolvedValue(2);

                const result = await gamificationService.getLeaderboard('global', undefined, 1, 10);

                // The service returns a union (global entries have `level` and
                // `totalXp`; path entries have `completedLessons`). We know this
                // call produced global entries, so assert that shape once.
                const entries = result.leaderboard as Array<{
                    userId: string;
                    fullName: string;
                    totalXp: number;
                    level: number;
                    rank: number;
                }>;

                expect(entries[0]).toMatchObject({
                    userId: 'u1',
                    fullName: 'يوسف',
                    totalXp: 2500,
                    rank: 1,
                });
                expect(entries[0].level).toBeGreaterThanOrEqual(7);
                expect(entries[1].rank).toBe(2);
                expect(result.total).toBe(2);
            });

            it('handles empty leaderboard', async () => {
                (prisma.userStats.findMany as jest.Mock).mockResolvedValue([]);
                (prisma.userStats.count as jest.Mock).mockResolvedValue(0);
                const result = await gamificationService.getLeaderboard('global', undefined, 1, 10);
                expect(result.leaderboard).toHaveLength(0);
                expect(result.total).toBe(0);
            });
        });

        describe('path scope', () => {
            it('returns path leaderboard by completed lessons', async () => {
                (prisma.enrollment.findMany as jest.Mock).mockResolvedValue([
                    { userId: 'u1' },
                    { userId: 'u2' },
                ]);
                (prisma.lessonProgress.groupBy as jest.Mock)
                    .mockResolvedValueOnce([
                        { userId: 'u1', _count: { _all: 5 } },
                        { userId: 'u2', _count: { _all: 3 } },
                    ])
                    .mockResolvedValueOnce([
                        { userId: 'u1', _count: { _all: 5 } },
                        { userId: 'u2', _count: { _all: 3 } },
                    ]);
                (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) =>
                    Promise.resolve({
                        id: where.id,
                        fullName: where.id === 'u1' ? 'User1' : 'User2',
                        displayName: null,
                        avatarUrl: null,
                    })
                );

                const result = await gamificationService.getLeaderboard('path', 'path-1', 1, 10);
                expect(result.leaderboard).toHaveLength(2);
                expect(result.leaderboard[0]).toMatchObject({
                    userId: 'u1',
                    completedLessons: 5,
                    rank: 1,
                });
            });

            it('returns empty when no enrollments', async () => {
                (prisma.enrollment.findMany as jest.Mock).mockResolvedValue([]);
                const result = await gamificationService.getLeaderboard('path', 'path-1', 1, 10);
                expect(result.leaderboard).toHaveLength(0);
            });
        });

        it('throws 400 for invalid scope', async () => {
            await expect(
                gamificationService.getLeaderboard('invalid' as any)
            ).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('getUserRank', () => {
        describe('global scope', () => {
            it('returns correct rank', async () => {
                (prisma.userStats.findUnique as jest.Mock).mockResolvedValue({
                    userId: 'user-1',
                    xp: 100,
                });
                (prisma.userStats.count as jest.Mock).mockResolvedValue(3);
                const rank = await gamificationService.getUserRank('user-1', 'global');
                expect(rank).toBe(4);
            });

            it('throws 404 if stats not found', async () => {
                (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(null);
                await expect(
                    gamificationService.getUserRank('bad', 'global')
                ).rejects.toThrow(AppError);
            });
        });

        describe('path scope', () => {
            it('returns rank based on completed lessons', async () => {
                (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(5);
                (prisma.lessonProgress.groupBy as jest.Mock).mockResolvedValue([
                    { userId: 'u1', _count: { _all: 8 } },
                    { userId: 'u2', _count: { _all: 5 } },
                    { userId: 'u3', _count: { _all: 3 } },
                ]);
                const rank = await gamificationService.getUserRank('user-1', 'path', 'path-1');
                expect(rank).toBe(2);
            });
        });

        it('throws 400 for invalid scope', async () => {
            await expect(
                gamificationService.getUserRank('u', 'invalid' as any)
            ).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('getStreak', () => {
        it('returns streak with derived lastActivityDate', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(mockStats);
            (prisma.lessonProgress.findFirst as jest.Mock).mockResolvedValue({
                lastAccessedAt: new Date('2026-09-11T15:30:00Z'),
            });

            const result = await gamificationService.getStreak('user-1');

            expect(result.currentStreak).toBe(3);
            expect(result.longestStreak).toBe(5);
            expect(result.streakFreezeAvailable).toBe(0);
            expect(result.lastActivityDate).toBe('2026-09-11');
        });

        it('returns null lastActivityDate when no progress', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(mockStats);
            (prisma.lessonProgress.findFirst as jest.Mock).mockResolvedValue(null);
            const result = await gamificationService.getStreak('user-1');
            expect(result.lastActivityDate).toBeNull();
        });

        it('throws 404 if stats not found', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(gamificationService.getStreak('bad')).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('getDailyQuests', () => {
        it('returns quests shaped for the frontend (xpAward, titleAr, descriptionAr)', async () => {
            const quests = [
                {
                    id: 'quest-1',
                    title: 'أكمل درساً واحداً',
                    titleEn: 'Complete 1 lesson',
                    description: 'أكمل أي درس اليوم',
                    descriptionEn: null,
                    xpReward: 20,
                    target: 1,
                    type: 'daily',
                    startDate: new Date(),
                    endDate: new Date(),
                    isActive: true,
                    userQuests: [
                        { userId: 'user-1', progress: 0, completed: false, completedAt: null },
                    ],
                },
            ];
            (prisma.quest.findMany as jest.Mock).mockResolvedValue(quests);

            const result = await gamificationService.getDailyQuests('user-1');

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 'quest-1',
                titleAr: 'أكمل درساً واحداً',
                titleEn: 'Complete 1 lesson',
                descriptionAr: 'أكمل أي درس اليوم',
                descriptionEn: null,
                xpAward: 20,
                target: 1,
                progress: 0,
                completed: false,
            });
        });

        it('returns empty if no quests', async () => {
            (prisma.quest.findMany as jest.Mock).mockResolvedValue([]);
            const result = await gamificationService.getDailyQuests('user-1');
            expect(result).toHaveLength(0);
        });
    });

    // =========================================================================
    describe('completeDailyQuest', () => {
        const mockQuest = {
            id: 'quest-1',
            type: 'daily',
            isActive: true,
            xpReward: 20,
            target: 1,
        };

        it('completes quest and awards XP', async () => {
            (prisma.quest.findUnique as jest.Mock).mockResolvedValue(mockQuest);
            (prisma.userQuest.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.userQuest.upsert as jest.Mock).mockResolvedValue({});
            (prisma.$transaction as jest.Mock).mockResolvedValue([]);

            const result = await gamificationService.completeDailyQuest('user-1', 'quest-1');
            expect(result).toEqual({ questId: 'quest-1', xpAwarded: 20 });
        });

        it('throws 404 if quest not found', async () => {
            (prisma.quest.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(
                gamificationService.completeDailyQuest('user-1', 'bad')
            ).rejects.toThrow(AppError);
        });

        it('throws 404 if quest is inactive or not daily', async () => {
            (prisma.quest.findUnique as jest.Mock).mockResolvedValue({
                ...mockQuest,
                type: 'weekly',
            });
            await expect(
                gamificationService.completeDailyQuest('user-1', 'quest-1')
            ).rejects.toThrow(AppError);
        });

        it('throws 409 if already completed', async () => {
            (prisma.quest.findUnique as jest.Mock).mockResolvedValue(mockQuest);
            (prisma.userQuest.findUnique as jest.Mock).mockResolvedValue({ completed: true });
            await expect(
                gamificationService.completeDailyQuest('user-1', 'quest-1')
            ).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('freezeStreak', () => {
        it('consumes a freeze', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue({
                userId: 'user-1',
                streakFreezeAvailable: 2,
                streak: 5,
            });
            (prisma.userStats.update as jest.Mock).mockResolvedValue({
                userId: 'user-1',
                streak: 5,
                streakFreezeAvailable: 1,
                lastStreakFreezeAt: new Date(),
            });

            const result = await gamificationService.freezeStreak('user-1');
            expect(result.streakFreezeAvailable).toBe(1);
            expect(prisma.userStats.update).toHaveBeenCalled();
        });

        it('throws 404 if stats not found', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(gamificationService.freezeStreak('bad')).rejects.toThrow(AppError);
        });

        it('throws 400 if no freezes available', async () => {
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue({
                userId: 'user-1',
                streakFreezeAvailable: 0,
                streak: 5,
            });
            await expect(gamificationService.freezeStreak('user-1')).rejects.toThrow(AppError);
            expect(prisma.userStats.update).not.toHaveBeenCalled();
        });
    });
});