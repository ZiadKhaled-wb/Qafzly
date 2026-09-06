import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const updateLessonProgress = async (userId: string, lessonId: string, data: any) => {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    const existing = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
    });

    const completedAt = data.completed ? new Date() : existing?.completedAt ?? null;

    if (existing) {
        return prisma.lessonProgress.update({
            where: { id: existing.id },
            data: {
                completed: data.completed ?? existing.completed,
                completedAt,
                timeSpent: data.timeSpent ?? existing.timeSpent,
                quizScore: data.quizScore ?? existing.quizScore,
                lastAccessedAt: new Date(),
            },
        });
    } else {
        return prisma.lessonProgress.create({
            data: {
                userId,
                lessonId,
                completed: data.completed ?? false,
                completedAt: data.completed ? new Date() : null,
                timeSpent: data.timeSpent ?? 0,
                quizScore: data.quizScore,
            },
        });
    }
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
                        select: { completed: true, completedAt: true, timeSpent: true, quizScore: true },
                    },
                },
            },
        },
    });

    const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
    let completedLessons = 0;
    modules.forEach(m => {
        m.lessons.forEach(l => {
            if (l.progress.length > 0 && l.progress[0].completed) completedLessons++;
        });
    });

    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
        pathId,
        totalLessons,
        completedLessons,
        progressPercent,
        modules,
    };
};