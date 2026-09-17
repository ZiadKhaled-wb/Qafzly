import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import * as certificateService from './certificate.service';
import { awardXpWithRecharge } from './recharge.service';

/**
 * Update the user's streak after a lesson completion. Best-effort.
 */
const updateStreakOnCompletion = async (userId: string): Promise<void> => {
    const stats = await prisma.userStats.findUnique({ where: { userId } });
    if (!stats) return;

    const startOfDay = (d: Date): number => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x.getTime();
    };

    const today = startOfDay(new Date());
    const yesterday = startOfDay(new Date(Date.now() - 24 * 60 * 60 * 1000));

    const lastCompletion = await prisma.lessonProgress.findFirst({
        where: { userId, completed: true, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
    });

    const last = lastCompletion?.completedAt ? startOfDay(lastCompletion.completedAt) : null;

    let newStreak: number;
    if (last === null) newStreak = 1;
    else if (last === today) newStreak = stats.streak > 0 ? stats.streak : 1;
    else if (last === yesterday) newStreak = stats.streak + 1;
    else newStreak = 1;

    const longest = Math.max(stats.longestStreak, newStreak);

    if (newStreak !== stats.streak || longest !== stats.longestStreak) {
        await prisma.userStats.update({
            where: { userId },
            data: { streak: newStreak, longestStreak: longest },
        });
    }
};

export const updateLessonProgress = async (userId: string, lessonId: string, data: any) => {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    const existing = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
    });

    const wasAlreadyCompleted = existing?.completed === true;
    const isNowCompleting = data.completed === true && !wasAlreadyCompleted;

    const completedAt = data.completed ? new Date() : existing?.completedAt ?? null;

    const progress = existing
        ? await prisma.lessonProgress.update({
              where: { id: existing.id },
              data: {
                  completed: data.completed ?? existing.completed,
                  completedAt,
                  timeSpent: data.timeSpent ?? existing.timeSpent,
                  quizScore: data.quizScore ?? existing.quizScore,
                  lastAccessedAt: new Date(),
              },
          })
        : await prisma.lessonProgress.create({
              data: {
                  userId,
                  lessonId,
                  completed: data.completed ?? false,
                  completedAt: data.completed ? new Date() : null,
                  timeSpent: data.timeSpent ?? 0,
                  quizScore: data.quizScore,
              },
          });

    // Award lesson-completion XP + run side effects — only on first transition
    if (isNowCompleting) {
        try {
            const xpEarned = await awardXpWithRecharge(
                userId,
                lesson.completionXpAward,
                lessonId
            );
            logger.info({ userId, lessonId, xpEarned }, 'Lesson completion XP awarded');
        } catch (err) {
            logger.error({ err, userId, lessonId }, 'Lesson completion XP award failed (non-blocking)');
        }

        try {
            await updateStreakOnCompletion(userId);
        } catch (err) {
            logger.error({ err, userId }, 'Streak update failed (non-blocking)');
        }

        try {
            await certificateService.tryAutoIssueCertificateForLesson(userId, lessonId);
        } catch (err) {
            logger.error({ err, userId, lessonId }, 'Certificate auto-issue failed (non-blocking)');
        }
    }

    return progress;
};

/**
 * Warm-up completion. Awards XP once per user per lesson.
 *
 * The warm-up is a single-answer riddle stored in `Lesson.warmUpJson`.
 * Correctness is evaluated server-side using the same Arabic normalization
 * used by FILL_BLANK slides.
 */
export const completeWarmUp = async (userId: string, lessonId: string, answer: string) => {
    const { evaluateWarmUpAnswer } = await import('./answerEvaluation.service');

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    const warmUpJson = lesson.warmUpJson as { xpAward?: number } | null;
    if (!warmUpJson) throw new AppError(404, 'لا يوجد تمرين إحماء لهذا الدرس');

    const evaluation = evaluateWarmUpAnswer(lesson.warmUpJson, answer);

    // Fetch or create the progress row
    const existing = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
    });
    if (existing?.warmUpCompletedAt) {
        throw new AppError(400, 'تم إكمال تمرين الإحماء بالفعل');
    }

    const xpAward = typeof warmUpJson.xpAward === 'number' ? warmUpJson.xpAward : 5;
    const xpEarned = evaluation.isCorrect ? xpAward : 0;

    await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: { warmUpCompletedAt: new Date() },
        create: {
            userId,
            lessonId,
            warmUpCompletedAt: new Date(),
        },
    });

    if (xpEarned > 0) {
        await awardXpWithRecharge(userId, xpEarned, lessonId);
    }

    return {
        lessonId,
        warmUpCompleted: true,
        isCorrect: evaluation.isCorrect,
        xpEarned,
    };
};

export const getPathProgress = async (userId: string, pathId: string) => {
    const path = await prisma.path.findUnique({ where: { id: pathId } });
    if (!path) throw new AppError(404, 'المسار غير موجود');

    const modules = await prisma.module.findMany({
        where: { pathId, isPublished: true },
        orderBy: { order: 'asc' },
        include: {
            lessons: {
                where: { isPublished: true },
                orderBy: { order: 'asc' },
                select: {
                    id: true,
                    title: true,
                    order: true,
                    progress: {
                        where: { userId },
                        select: {
                            completed: true,
                            completedAt: true,
                            timeSpent: true,
                            quizScore: true,
                        },
                    },
                },
            },
        },
    });

    const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
    let completedLessons = 0;
    modules.forEach((m) => {
        m.lessons.forEach((l) => {
            if (l.progress.length > 0 && l.progress[0].completed) completedLessons++;
        });
    });

    const progressPercent =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
        pathId,
        totalLessons,
        completedLessons,
        progressPercent,
        modules,
    };
};