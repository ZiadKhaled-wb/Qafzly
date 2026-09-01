import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const enrollUser = async (userId: string, courseId: string) => {
    // Check if course exists and is published
    const course = await prisma.course.findFirst({
        where: { id: courseId, isPublished: true, deletedAt: null },
    });
    if (!course) throw new AppError(404, 'الكورس غير موجود أو غير منشور');

    // Check if already enrolled
    const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
    });
    if (existing) {
        if (existing.isActive) {
            throw new AppError(409, 'أنت مسجل بالفعل في هذا الكورس');
        } else {
            // Reactivate
            return prisma.enrollment.update({
                where: { id: existing.id },
                data: { isActive: true, expiresAt: null },
            });
        }
    }

    return prisma.enrollment.create({
        data: {
            userId,
            courseId,
        },
    });
};

export const unenrollUser = async (userId: string, courseId: string) => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || !enrollment.isActive) throw new AppError(404, 'أنت غير مسجل في هذا الكورس');

    return prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { isActive: false, expiresAt: new Date() },
    });
};

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
                course: {
                    select: {
                        id: true,
                        title: true,
                        featuredImage: true,
                        difficulty: true,
                    },
                },
            },
        }),
        prisma.enrollment.count({ where }),
    ]);

    return { enrollments, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const listCourseEnrollments = async (courseId: string, params: any) => {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = { courseId, isActive: true };
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