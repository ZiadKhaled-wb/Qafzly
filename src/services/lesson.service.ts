import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const createLesson = async (data: any) => {
    // Verify module exists
    const module = await prisma.module.findUnique({ where: { id: data.moduleId } });
    if (!module) throw new AppError(404, 'الوحدة غير موجودة');

    return prisma.lesson.create({
        data,
    });
};

export const listLessonsByModule = async (moduleId: string, params: any, includeUnpublished: boolean = false) => {
    const { page, limit, isPublished } = params;
    const skip = (page - 1) * limit;

    const where: any = { moduleId };
    if (!includeUnpublished) {
        where.isPublished = true;
    } else if (isPublished !== undefined) {
        where.isPublished = isPublished;
    }

    const [lessons, total] = await Promise.all([
        prisma.lesson.findMany({
            where,
            skip,
            take: limit,
            orderBy: { order: 'asc' },
            include: {
                _count: { select: { progress: true, quizQuestions: true } },
            },
        }),
        prisma.lesson.count({ where }),
    ]);

    return { lessons, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getLessonById = async (id: string) => {
    const lesson = await prisma.lesson.findUnique({
        where: { id },
        include: {
            module: { select: { id: true, title: true, courseId: true } },
            quizQuestions: {
                orderBy: { order: 'asc' },
            },
        },
    });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');
    return lesson;
};

export const updateLesson = async (id: string, data: any) => {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    return prisma.lesson.update({
        where: { id },
        data,
    });
};

export const deleteLesson = async (id: string) => {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    return prisma.lesson.delete({ where: { id } });
};