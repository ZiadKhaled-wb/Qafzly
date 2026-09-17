import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as bossBattleService from '../bossBattle.service';

jest.mock('../../config/database', () => ({
    prisma: {
        module: { findUnique: jest.fn() },
        bossBattle: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        bossBattleQuestion: {
            create: jest.fn(),
        },
        userBossBattleProgress: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        userStats: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
        },
        badge: {
            findFirst: jest.fn(),
        },
        userBadge: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
    },
}));

jest.mock('../../config/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Boss Battle Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.badge.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.userBadge.create as jest.Mock).mockResolvedValue({});
    });

    // =========================================================================
    // createBossBattle
    // =========================================================================
    describe('createBossBattle', () => {
        it('should create boss battle with questions', async () => {
            (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1' });
            (prisma.bossBattle.create as jest.Mock).mockResolvedValue({
                id: 'boss-1',
                questions: [],
            });

            const data = {
                titleAr: 'وحش الفوضى',
                narrativeAr: 'هاجم الوحش المدينة',
                monsterNameAr: 'وحش',
                questions: [
                    { questionAr: 'Q1', optionsAr: ['a', 'b', 'c', 'd'], correctIndex: 0, order: 1 },
                    { questionAr: 'Q2', optionsAr: ['a', 'b', 'c', 'd'], correctIndex: 1, order: 2 },
                    { questionAr: 'Q3', optionsAr: ['a', 'b', 'c', 'd'], correctIndex: 2, order: 3 },
                ],
            };
            await bossBattleService.createBossBattle('mod-1', data);
            expect(prisma.bossBattle.create).toHaveBeenCalled();
        });

        it('should throw 404 if module not found', async () => {
            (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(bossBattleService.createBossBattle('bad', {})).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    // getBossBattle
    // =========================================================================
    describe('getBossBattle', () => {
        it('should return battle with questions for anonymous', async () => {
            (prisma.bossBattle.findFirst as jest.Mock).mockResolvedValue({
                id: 'boss-1',
                questions: [],
            });
            const result = await bossBattleService.getBossBattle('mod-1');
            expect(result).toEqual({ id: 'boss-1', questions: [] });
            expect(prisma.userBossBattleProgress.findUnique).not.toHaveBeenCalled();
        });

        it('should return battle with user progress', async () => {
            (prisma.bossBattle.findFirst as jest.Mock).mockResolvedValue({
                id: 'boss-1',
                questions: [],
            });
            (prisma.userBossBattleProgress.findUnique as jest.Mock).mockResolvedValue({
                score: 4,
                totalQuestions: 5,
                xpEarned: 50,
                victoryLevel: 'legend',
                completedAt: new Date(),
            });
            const result = (await bossBattleService.getBossBattle('mod-1', 'user-1')) as any;
            expect(result.completed).toBe(true);
            expect(result.lastScore).toBe(4);
        });

        it('should throw 404 if no boss battle exists', async () => {
            (prisma.bossBattle.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(bossBattleService.getBossBattle('mod-1')).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    // submitBossBattle
    // =========================================================================
    describe('submitBossBattle', () => {
        // 5 questions so all 4 tiers are mathematically reachable.
        // Correct answers are: q1=0, q2=1, q3=2, q4=3, q5=4
        // Percentages: 5/5=100 (legend), 4/5=80 (legend), 3/5=60 (warrior),
        //              2/5=40 (trainee), 1/5=20 (retry), 0/5=0 (retry)
        const mockBattle = {
            id: 'boss-1',
            moduleId: 'mod-1',
            questions: [
                { id: 'q1', correctIndex: 0, xpAward: 10 },
                { id: 'q2', correctIndex: 1, xpAward: 10 },
                { id: 'q3', correctIndex: 2, xpAward: 10 },
                { id: 'q4', correctIndex: 3, xpAward: 10 },
                { id: 'q5', correctIndex: 4, xpAward: 10 },
            ],
            victoryBonusPerfect: 50,
            victoryBonusGood: 30,
            victoryBonusFair: 15,
            victoryBonusRetry: 5,
        };

        beforeEach(() => {
            (prisma.bossBattle.findFirst as jest.Mock).mockResolvedValue(mockBattle);
            (prisma.userBossBattleProgress.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.userBossBattleProgress.create as jest.Mock).mockResolvedValue({});
            (prisma.userStats.upsert as jest.Mock).mockResolvedValue({});
            (prisma.userStats.findUnique as jest.Mock).mockResolvedValue({ xp: 100, level: 2 });
        });

        // Reusable answer sets for each tier
        const answersByTier = {
            legend: [
                { questionId: 'q1', selectedIndex: 0 },
                { questionId: 'q2', selectedIndex: 1 },
                { questionId: 'q3', selectedIndex: 2 },
                { questionId: 'q4', selectedIndex: 3 },
                { questionId: 'q5', selectedIndex: 4 },
            ], // 5/5 = 100%
            warrior: [
                { questionId: 'q1', selectedIndex: 0 },
                { questionId: 'q2', selectedIndex: 1 },
                { questionId: 'q3', selectedIndex: 2 },
                { questionId: 'q4', selectedIndex: 0 }, // wrong
                { questionId: 'q5', selectedIndex: 0 }, // wrong
            ], // 3/5 = 60%
            trainee: [
                { questionId: 'q1', selectedIndex: 0 },
                { questionId: 'q2', selectedIndex: 1 },
                { questionId: 'q3', selectedIndex: 0 }, // wrong
                { questionId: 'q4', selectedIndex: 0 }, // wrong
                { questionId: 'q5', selectedIndex: 0 }, // wrong
            ], // 2/5 = 40%
            retry: [
                { questionId: 'q1', selectedIndex: 0 },
                { questionId: 'q2', selectedIndex: 0 }, // wrong
                { questionId: 'q3', selectedIndex: 0 }, // wrong
                { questionId: 'q4', selectedIndex: 0 }, // wrong
                { questionId: 'q5', selectedIndex: 0 }, // wrong
            ], // 1/5 = 20%
        };

        // ---------------------------------------------------------------------
        // Tier calculation
        // ---------------------------------------------------------------------
        it('should calculate legend victory for 80%+ score', async () => {
            const result = await bossBattleService.submitBossBattle(
                'mod-1',
                'user-1',
                answersByTier.legend
            );
            expect(result.victoryLevel).toBe('legend');
            expect(result.xpEarned).toBe(50);
            expect(result.victoryLabelAr).toBe('أسطورة');
            expect(result.scorePercent).toBe(100);
        });

        it('should calculate warrior victory for 60-79%', async () => {
            const result = await bossBattleService.submitBossBattle(
                'mod-1',
                'user-1',
                answersByTier.warrior
            );
            expect(result.victoryLevel).toBe('warrior');
            expect(result.xpEarned).toBe(30);
            expect(result.scorePercent).toBe(60);
        });

        it('should calculate trainee victory for 40-59%', async () => {
            const result = await bossBattleService.submitBossBattle(
                'mod-1',
                'user-1',
                answersByTier.trainee
            );
            expect(result.victoryLevel).toBe('trainee');
            expect(result.xpEarned).toBe(15);
            expect(result.scorePercent).toBe(40);
        });

        it('should calculate retry tier for <40% and use "مش هستسلم" label', async () => {
            const result = await bossBattleService.submitBossBattle(
                'mod-1',
                'user-1',
                answersByTier.retry
            );
            expect(result.victoryLevel).toBe('retry');
            expect(result.xpEarned).toBe(5);
            expect(result.victoryLabelAr).toBe('مش هستسلم');
            expect(result.scorePercent).toBe(20);
        });

        // ---------------------------------------------------------------------
        // Badge awarding — all four tiers (Sprint 12)
        // ---------------------------------------------------------------------
        describe('badge awarding', () => {
            const tierCases = [
                { tier: 'legend', label: 'أسطورة المدينة', answers: answersByTier.legend },
                { tier: 'warrior', label: 'محارب المدينة', answers: answersByTier.warrior },
                { tier: 'trainee', label: 'متدرب المدينة', answers: answersByTier.trainee },
                { tier: 'retry', label: 'مش هستسلم', answers: answersByTier.retry },
            ];

            tierCases.forEach(({ tier, label, answers: tierAnswers }) => {
                it(`should award the "${label}" badge on ${tier} tier`, async () => {
                    (prisma.badge.findFirst as jest.Mock).mockResolvedValue({
                        id: `badge-${tier}`,
                        name: label,
                    });
                    (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue(null);

                    const result = await bossBattleService.submitBossBattle(
                        'mod-1',
                        'user-1',
                        tierAnswers
                    );

                    expect(prisma.badge.findFirst).toHaveBeenCalledWith({
                        where: { name: label },
                    });
                    expect(prisma.userBadge.create).toHaveBeenCalledWith({
                        data: { userId: 'user-1', badgeId: `badge-${tier}` },
                    });
                    expect(result.badgesEarned).toEqual([label]);
                });
            });

            it('should not duplicate a badge the user already earned', async () => {
                (prisma.badge.findFirst as jest.Mock).mockResolvedValue({
                    id: 'badge-legend',
                    name: 'أسطورة المدينة',
                });
                (prisma.userBadge.findUnique as jest.Mock).mockResolvedValue({
                    userId: 'user-1',
                    badgeId: 'badge-legend',
                });

                const result = await bossBattleService.submitBossBattle(
                    'mod-1',
                    'user-1',
                    answersByTier.legend
                );

                expect(prisma.userBadge.create).not.toHaveBeenCalled();
                expect(result.badgesEarned).toEqual(['أسطورة المدينة']);
            });

            it('should succeed with empty badgesEarned if badge is not in the catalog', async () => {
                (prisma.badge.findFirst as jest.Mock).mockResolvedValue(null);

                const result = await bossBattleService.submitBossBattle(
                    'mod-1',
                    'user-1',
                    answersByTier.legend
                );

                expect(prisma.userBadge.create).not.toHaveBeenCalled();
                expect(result.badgesEarned).toEqual([]);
                expect(result.victoryLevel).toBe('legend');
            });
        });

        // ---------------------------------------------------------------------
        // Validation
        // ---------------------------------------------------------------------
        it('should throw 400 if duplicate submission', async () => {
            (prisma.userBossBattleProgress.findUnique as jest.Mock).mockResolvedValue({
                id: 'progress-1',
            });
            await expect(
                bossBattleService.submitBossBattle('mod-1', 'user-1', [])
            ).rejects.toThrow(AppError);
        });

        it('should throw 400 if missing answers', async () => {
            await expect(
                bossBattleService.submitBossBattle('mod-1', 'user-1', [
                    { questionId: 'q1', selectedIndex: 0 },
                ])
            ).rejects.toThrow(AppError);
        });

        it('should throw 400 if answer contains unknown questionId', async () => {
            const answers = [
                { questionId: 'unknown', selectedIndex: 0 },
                { questionId: 'q2', selectedIndex: 1 },
                { questionId: 'q3', selectedIndex: 2 },
                { questionId: 'q4', selectedIndex: 3 },
                { questionId: 'q5', selectedIndex: 4 },
            ];
            await expect(
                bossBattleService.submitBossBattle('mod-1', 'user-1', answers)
            ).rejects.toThrow(AppError);
        });

        it('should throw 400 if selectedIndex is undefined', async () => {
            const answers = [
                { questionId: 'q1' }, // missing selectedIndex
                { questionId: 'q2', selectedIndex: 1 },
                { questionId: 'q3', selectedIndex: 2 },
                { questionId: 'q4', selectedIndex: 3 },
                { questionId: 'q5', selectedIndex: 4 },
            ];
            await expect(
                bossBattleService.submitBossBattle('mod-1', 'user-1', answers)
            ).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    // updateBossBattle
    // =========================================================================
    describe('updateBossBattle', () => {
        it('should update boss battle', async () => {
            (prisma.bossBattle.findUnique as jest.Mock).mockResolvedValue({ id: 'boss-1' });
            (prisma.bossBattle.update as jest.Mock).mockResolvedValue({
                id: 'boss-1',
                titleAr: 'Updated',
            });

            const result = await bossBattleService.updateBossBattle('boss-1', {
                titleAr: 'Updated',
            });
            expect(result.titleAr).toBe('Updated');
            expect(prisma.bossBattle.update).toHaveBeenCalledWith({
                where: { id: 'boss-1' },
                data: expect.objectContaining({ titleAr: 'Updated' }),
            });
        });

        it('should throw 404 if boss battle not found', async () => {
            (prisma.bossBattle.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(bossBattleService.updateBossBattle('bad', {})).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    // deleteBossBattle
    // =========================================================================
    describe('deleteBossBattle', () => {
        it('should delete boss battle', async () => {
            (prisma.bossBattle.findUnique as jest.Mock).mockResolvedValue({ id: 'boss-1' });
            await bossBattleService.deleteBossBattle('boss-1');
            expect(prisma.bossBattle.delete).toHaveBeenCalledWith({ where: { id: 'boss-1' } });
        });

        it('should throw 404 if boss battle not found', async () => {
            (prisma.bossBattle.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(bossBattleService.deleteBossBattle('bad')).rejects.toThrow(AppError);
        });
    });
});