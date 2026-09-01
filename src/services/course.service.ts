import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const createCourse = async (data: any) => {
    return prisma.course.create({
        data,
        include: {
            category: true,
        },
    });
};

export const listCourses = async (params: any, isAdmin: boolean = false) => {
    const {
        page,
        limit,
        search,
        categoryId,
        difficulty,
        minPrice,
        maxPrice,
        isPublished,
        isFeatured,
        sortBy,
        order,
    } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { titleEn: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (difficulty) where.difficulty = difficulty;
    if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {};
        if (minPrice !== undefined) where.price.gte = minPrice;
        if (maxPrice !== undefined) where.price.lte = maxPrice;
    }
    if (isPublished !== undefined) where.isPublished = isPublished;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (!isAdmin) {
        where.isPublished = true;
        where.deletedAt = null;
    } else {
        where.deletedAt = null; // Admin sees all non-deleted, including unpublished
    }

    const orderBy: any = {};
    orderBy[sortBy] = order;

    const [courses, total] = await Promise.all([
        prisma.course.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: {
                category: { select: { id: true, name: true, nameEn: true } },
                _count: {
                    select: { modules: true, enrollments: true },
                },
            },
        }),
        prisma.course.count({ where }),
    ]);

    return { courses, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getCourseById = async (id: string, includeUnpublished: boolean = false) => {
    const where: any = { id, deletedAt: null};
    if (!includeUnpublished) {
        where.isPublished = true;
    }

    const course = await prisma.course.findFirst({
        where,
        include: {
            category: true,
            modules: {
                where: includeUnpublished ? {} : { isPublished: true },
                orderBy: { order: 'asc' },
                include: {
                    lessons: {
                        where: includeUnpublished ? {} : { isPublished: true },
                        orderBy: { order: 'asc' },
                        select: {
                            id: true,
                            title: true,
                            titleEn: true,
                            contentType: true,
                            isPreview: true,
                            estimatedTime: true,
                            order: true,
                        },
                    },
                },
            },
        },
    });
    if (!course) throw new AppError(404, 'الكورس غير موجود');
    return course;
};

export const updateCourse = async (id: string, data: any) => {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) throw new AppError(404, 'الكورس غير موجود');

    return prisma.course.update({
        where: { id },
        data,
        include: {
            category: true,
        },
    });
};

export const deleteCourse = async (id: string) => {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) throw new AppError(404, 'الكورس غير موجود');

    // Soft delete
    return prisma.course.update({
        where: { id },
        data: { deletedAt: new Date(), isPublished: false },
    });
};

export const publishCourse = async (id: string, publish: boolean) => {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) throw new AppError(404, 'الكورس غير موجود');

    return prisma.course.update({
        where: { id },
        data: { isPublished: publish },
    });
};