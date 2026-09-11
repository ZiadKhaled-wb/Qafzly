import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const enrollUser = async (userId: string, pathId: string) => {
    const path = await prisma.path.findFirst({
        where: { id: pathId, isPublished: true, deletedAt: null },
    });
    if (!path) throw new AppError(404, 'الكورس غير موجود أو غير منشور');

    const existing = await prisma.enrollment.findUnique({
        where: { userId_pathId: { userId, pathId } },
    });
    if (existing) {
        if (existing.isActive) {
            throw new AppError(409, 'أنت مسجل بالفعل في هذا الكورس');
        }
        return prisma.enrollment.update({
            where: { id: existing.id },
            data: { isActive: true, expiresAt: null },
        });
    }

    return prisma.enrollment.create({
        data: { userId, pathId },
    });
};

export const unenrollUser = async (userId: string, pathId: string) => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { userId_pathId: { userId, pathId } },
    });
    if (!enrollment || !enrollment.isActive) {
        throw new AppError(404, 'أنت غير مسجل في هذا الكورس');
    }

    return prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { isActive: false, expiresAt: new Date() },
    });
};

/**
 * Returns the current user's active enrollments with computed progress
 * and the next lesson the user hasn't completed yet.
 *
 * Response shape matches the Student Dashboard spec:
 *   {
 *     id, pathId, pathTitleAr, pathTitleEn,
 *     progress (0-100), currentLesson (or null), enrolledAt,
 *     featuredImage, difficulty
 *   }
 */
export const listUserEnrollments = async (userId: string, params: any) => {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = { userId, isActive: true };
    const [enrollments, total] = await Promise.all([
        prisma.enrollment.findMany({
            where,
            skip,
            take: limit,
            orderBy: { enrolledAt: 'desc' },
            include: {
                path: {
                    select: {
                        id: true,
                        title: true,
                        titleEn: true,
                        featuredImage: true,
                        difficulty: true,
                    },
                },
            },
        }),
        prisma.enrollment.count({ where }),
    ]);

    if (enrollments.length === 0) {
        return { enrollments: [], total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const pathIds = enrollments.map((e) => e.pathId);

    // Load all published lessons across all enrolled paths (one query)
    const allLessons = await prisma.lesson.findMany({
        where: {
            isPublished: true,
            module: { isPublished: true, pathId: { in: pathIds } },
        },
        orderBy: [{ order: 'asc' }],
        select: {
            id: true,
            title: true,
            order: true,
            moduleId: true,
            module: {
                select: { pathId: true, title: true, order: true },
            },
        },
    });

    // Load user's completions for those lessons (one query)
    const completed = await prisma.lessonProgress.findMany({
        where: {
            userId,
            completed: true,
            lessonId: { in: allLessons.map((l) => l.id) },
        },
        select: { lessonId: true },
    });
    const completedSet = new Set(completed.map((p) => p.lessonId));

    // Sort lessons by module order, then lesson order (in memory, since
    // Prisma's nested orderBy is unreliable across relations)
    const sortedLessons = [...allLessons].sort((a, b) => {
        if (a.module.order !== b.module.order) return a.module.order - b.module.order;
        return a.order - b.order;
    });

    const result = enrollments.map((enr) => {
        const pathLessons = sortedLessons.filter((l) => l.module.pathId === enr.pathId);
        const totalLessons = pathLessons.length;
        const completedCount = pathLessons.filter((l) => completedSet.has(l.id)).length;
        const progress =
            totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
        const nextLesson = pathLessons.find((l) => !completedSet.has(l.id)) ?? null;

        return {
            id: enr.id,
            pathId: enr.pathId,
            pathTitleAr: enr.path.title,
            pathTitleEn: enr.path.titleEn,
            featuredImage: enr.path.featuredImage,
            difficulty: enr.path.difficulty,
            progress,
            currentLesson: nextLesson
                ? {
                      id: nextLesson.id,
                      titleAr: nextLesson.title,
                      moduleNameAr: nextLesson.module.title,
                  }
                : null,
            enrolledAt: enr.enrolledAt,
        };
    });

    return { enrollments: result, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const listPathEnrollments = async (pathId: string, params: any) => {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = { pathId, isActive: true };
    const [enrollments, total] = await Promise.all([
        prisma.enrollment.findMany({
            where,
            skip,
            take: limit,
            orderBy: { enrolledAt: 'desc' },
            include: {
                user: {
                    select: { id: true, fullName: true, email: true, avatarUrl: true },
                },
            },
        }),
        prisma.enrollment.count({ where }),
    ]);

    return { enrollments, total, page, limit, totalPages: Math.ceil(total / limit) };
};