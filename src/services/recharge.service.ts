import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const getRechargeStatus = async (lessonId: string, userId: string) => {
    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: {
        id: true,
        rechargeMessageAr: true,
        rechargeMessageEn: true,
        rechargeXpBoost: true,
        rechargeBoostMultiplier: true,
        rechargeBoostWindowHours: true,
        module: {
            select: {
            lessons: {
                orderBy: { order: 'asc' },
                select: { id: true, order: true },
            },
            },
        },
        },
    });

    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    const lessons = lesson.module.lessons;
    const currentIndex = lessons.findIndex(l => l.id === lessonId);

    let isRecharging = false;
    let remainingSeconds = 0;
    let xpBoostAvailable = false;
    let xpBoostMultiplier = 1;
    let xpBoostWindowHours = lesson.rechargeBoostWindowHours;
    let xpBoostExpiresInSeconds = 0;

    if (currentIndex > 0) {
        const previousLesson = lessons[currentIndex - 1];
        const prevProgress = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: previousLesson.id } },
        select: { completedAt: true },
        });

        if (prevProgress?.completedAt) {
        const now = new Date();
        const completedAt = prevProgress.completedAt;
        const windowMs = lesson.rechargeBoostWindowHours * 60 * 60 * 1000;
        const nextAvailableAt = new Date(completedAt.getTime() + windowMs);

        if (now < nextAvailableAt) {
            isRecharging = true;
            remainingSeconds = Math.ceil((nextAvailableAt.getTime() - now.getTime()) / 1000);
            if (lesson.rechargeXpBoost) {
            xpBoostAvailable = true;
            xpBoostMultiplier = lesson.rechargeBoostMultiplier;
            xpBoostExpiresInSeconds = remainingSeconds;
            }
        }
        }
    }

    return {
        isRecharging,
        remainingSeconds,
        rechargeMessageAr: lesson.rechargeMessageAr ?? 'أحسنت! قدراتك بتتشحن دلوقتي. ارجع بكرة عشان تاخد 2x XP Boost!',
        rechargeMessageEn: lesson.rechargeMessageEn ?? null,
        xpBoostAvailable,
        xpBoostMultiplier,
        xpBoostWindowHours,
        xpBoostExpiresInSeconds,
    };
};

export const awardXpWithRecharge = async (userId: string, baseXp: number, lessonId: string): Promise<number> => {
    if (baseXp <= 0) return 0;

    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: {
        id: true,
        rechargeXpBoost: true,
        rechargeBoostMultiplier: true,
        rechargeBoostWindowHours: true,
        module: {
            select: {
            lessons: {
                orderBy: { order: 'asc' },
                select: { id: true, order: true },
            },
            },
        },
        },
    });

    let multiplier = 1;
    if (lesson?.rechargeXpBoost) {
        const lessons = lesson.module.lessons;
        const currentIndex = lessons.findIndex(l => l.id === lessonId);
        if (currentIndex > 0) {
        const previousLesson = lessons[currentIndex - 1];
        const prevProgress = await prisma.lessonProgress.findUnique({
            where: { userId_lessonId: { userId, lessonId: previousLesson.id } },
            select: { completedAt: true },
        });
        if (prevProgress?.completedAt) {
            const now = new Date();
            const windowMs = lesson.rechargeBoostWindowHours * 60 * 60 * 1000;
            const nextAvailableAt = new Date(prevProgress.completedAt.getTime() + windowMs);
            if (now < nextAvailableAt) {
            multiplier = lesson.rechargeBoostMultiplier;
            }
        }
        }
    }

    const totalXp = baseXp * multiplier;
    await prisma.userStats.upsert({
        where: { userId },
        update: { xp: { increment: totalXp } },
        create: { userId, xp: totalXp },
    });

    return totalXp;
};