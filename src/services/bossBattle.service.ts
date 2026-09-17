import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

const VICTORY_LABELS: Record<string, string> = {
    legend: 'أسطورة',
    warrior: 'محارب',
    trainee: 'متدرب',
    retry: 'مش هستسلم',   // updated per Content — replaces 'حاول تاني'
};

const getVictoryLabelAr = (level: string): string =>
    VICTORY_LABELS[level] ?? level;

/**
 * Map a victory tier to its badge name (from the Content team's catalog)
 * and persist a UserBadge row if not already earned.
 */
const BOSS_BATTLE_BADGES: Record<string, string> = {
    legend: 'أسطورة المدينة',
    warrior: 'محارب المدينة',
    trainee: 'متدرب المدينة',
    retry: 'مش هستسلم',
};

const awardBossBattleBadge = async (
    userId: string,
    victoryLevel: string
): Promise<string[]> => {
    const badgeName = BOSS_BATTLE_BADGES[victoryLevel];
    if (!badgeName) return [];

    const badge = await prisma.badge.findFirst({ where: { name: badgeName } });
    if (!badge) {
        // Badge not seeded yet — skip award silently, do not fail the submission
        logger.warn({ badgeName, victoryLevel }, 'Boss battle badge not found in catalog');
        return [];
    }

    const existing = await prisma.userBadge.findUnique({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
    });
    if (existing) return [badge.name];

    await prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
    });
    return [badge.name];
};

export const createBossBattle = async (moduleId: string, data: any) => {
    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) throw new AppError(404, 'الوحدة غير موجودة');

    return prisma.bossBattle.create({
        data: {
        moduleId,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        narrativeAr: data.narrativeAr,
        narrativeEn: data.narrativeEn,
        monsterNameAr: data.monsterNameAr,
        monsterNameEn: data.monsterNameEn,
        victoryBonusPerfect: data.victoryBonusPerfect,
        victoryBonusGood: data.victoryBonusGood,
        victoryBonusFair: data.victoryBonusFair,
        victoryBonusRetry: data.victoryBonusRetry,
        questions: {
            create: data.questions.map((q: any) => ({
            questionAr: q.questionAr,
            questionEn: q.questionEn,
            optionsAr: q.optionsAr,
            optionsEn: q.optionsEn,
            correctIndex: q.correctIndex,
            explanationAr: q.explanationAr,
            explanationEn: q.explanationEn,
            xpAward: q.xpAward ?? 10,
            order: q.order,
            })),
        },
        },
        include: { questions: true },
    });
};

export const updateBossBattle = async (battleId: string, data: any) => {
    const battle = await prisma.bossBattle.findUnique({ where: { id: battleId } });
    if (!battle) throw new AppError(404, 'معركة الزعيم غير موجودة');

    // Simple update for scalar fields; question management can be separate
    return prisma.bossBattle.update({
        where: { id: battleId },
        data: {
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        narrativeAr: data.narrativeAr,
        narrativeEn: data.narrativeEn,
        monsterNameAr: data.monsterNameAr,
        monsterNameEn: data.monsterNameEn,
        victoryBonusPerfect: data.victoryBonusPerfect,
        victoryBonusGood: data.victoryBonusGood,
        victoryBonusFair: data.victoryBonusFair,
        victoryBonusRetry: data.victoryBonusRetry,
        },
    });
};

export const deleteBossBattle = async (battleId: string) => {
    const battle = await prisma.bossBattle.findUnique({ where: { id: battleId } });
    if (!battle) throw new AppError(404, 'معركة الزعيم غير موجودة');

    await prisma.bossBattle.delete({ where: { id: battleId } });
};

export const getBossBattle = async (moduleId: string, userId?: string) => {
    const battle = await prisma.bossBattle.findFirst({
        where: { moduleId },
        include: {
        questions: {
            orderBy: { order: 'asc' },
            select: {
            id: true,
            questionAr: true,
            questionEn: true,
            optionsAr: true,
            optionsEn: true,
            xpAward: true,
            order: true,
            },
        },
        },
    });
    if (!battle) throw new AppError(404, 'لا توجد معركة زعيم لهذه الوحدة');

    if (!userId) return battle;

    // Get user progress if exists
    const progress = await prisma.userBossBattleProgress.findUnique({
        where: { userId_bossBattleId: { userId, bossBattleId: battle.id } },
        select: { score: true, totalQuestions: true, xpEarned: true, victoryLevel: true, completedAt: true },
    });

    return {
        ...battle,
        completed: !!progress,
        lastScore: progress?.score ?? null,
        lastVictoryLevel: progress?.victoryLevel ?? null,
    };
};

export const submitBossBattle = async (moduleId: string, userId: string, answers: any[]) => {
    const battle = await prisma.bossBattle.findFirst({
        where: { moduleId },
        include: { questions: true },
    });
    if (!battle) throw new AppError(404, 'لا توجد معركة زعيم لهذه الوحدة');

    // Prevent duplicate submission
    const existingProgress = await prisma.userBossBattleProgress.findUnique({
        where: { userId_bossBattleId: { userId, bossBattleId: battle.id } },
    });
    if (existingProgress) throw new AppError(400, 'لقد قمت بالفعل بتقديم هذه المعركة');

    // Validate answers
    if (answers.length < battle.questions.length) {
        throw new AppError(400, 'يجب الإجابة على جميع الأسئلة');
    }

    let correctCount = 0;
    const answerMap = new Map(answers.map(a => [a.questionId, a.selectedIndex]));

    for (const question of battle.questions) {
        const selected = answerMap.get(question.id);
        if (selected === undefined) throw new AppError(400, 'يجب الإجابة على جميع الأسئلة');
        if (selected === question.correctIndex) correctCount++;
    }

    const totalQuestions = battle.questions.length;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);

    let victoryLevel: string;
    let xpEarned: number;

    if (scorePercent >= 80) {
        victoryLevel = 'legend';
        xpEarned = battle.victoryBonusPerfect;
    } else if (scorePercent >= 60) {
        victoryLevel = 'warrior';
        xpEarned = battle.victoryBonusGood;
    } else if (scorePercent >= 40) {
        victoryLevel = 'trainee';
        xpEarned = battle.victoryBonusFair;
    } else {
        victoryLevel = 'retry';
        xpEarned = battle.victoryBonusRetry;
    }

    // Award XP
    await prisma.userBossBattleProgress.create({
        data: {
        userId,
        bossBattleId: battle.id,
        score: correctCount,
        totalQuestions,
        xpEarned,
        victoryLevel,
        completedAt: new Date(),
        },
    });

    await prisma.userStats.upsert({
        where: { userId },
        update: { xp: { increment: xpEarned } },
        create: { userId, xp: xpEarned },
    });

   // Award the tier-specific badge (real persistence, not just response echo)
    const badgesEarned = await awardBossBattleBadge(userId, victoryLevel);

    const stats = await prisma.userStats.findUnique({ where: { userId } });

    return {
        score: correctCount,
        totalQuestions,
        scorePercent,
        xpEarned,
        victoryLevel,
        victoryLabelAr: getVictoryLabelAr(victoryLevel),
        totalXp: stats?.xp ?? 0,
        newLevel: stats?.level ?? null,
        badgesEarned,
    };
};