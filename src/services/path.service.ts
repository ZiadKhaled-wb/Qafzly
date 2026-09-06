import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { Prisma } from '@prisma/client';

export const listPaths = async (params: any) => {
    const {
        page = 1,
        limit = 20,
        search,
        categoryId,
        difficulty,
        minPrice,
        maxPrice,
        isFeatured,
        sortBy = 'createdAt',
        order = 'desc',
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {
        deletedAt: null,
        isPublished: true,
    };

    if (search) {
        where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { titleEn: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { descriptionEn: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (difficulty) where.difficulty = difficulty;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {};
        if (minPrice !== undefined) where.price.gte = minPrice;
        if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const [paths, total] = await Promise.all([
        prisma.path.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
            category: true,
            _count: { select: { modules: true } },
        },
        }),
        prisma.path.count({ where }),
    ]);

    return { paths, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const listAllPathsAdmin = async (params: any) => {
    const {
        page = 1,
        limit = 20,
        search,
        categoryId,
        difficulty,
        isPublished,
        isFeatured,
    } = params;

    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

    if (search) {
        where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { titleEn: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (difficulty) where.difficulty = difficulty;
    if (isPublished !== undefined) where.isPublished = isPublished;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;

    const [paths, total] = await Promise.all([
        prisma.path.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
        }),
        prisma.path.count({ where }),
    ]);

    return { paths, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getPathById = async (id: string, includeUnpublished = false) => {
    const where: any = { id, deletedAt: null };
    if (!includeUnpublished) {
        where.isPublished = true;
    }
    const path = await prisma.path.findFirst({
        where,
        include: {
        category: true,
        modules: {
            where: { isPublished: true },
            orderBy: { order: 'asc' },
            include: {
            lessons: {
                where: { isPublished: true },
                orderBy: { order: 'asc' },
                select: {
                id: true,
                title: true,
                titleEn: true,
                contentType: true,
                videoUrl: true,
                isPreview: true,
                estimatedTime: true,
                order: true,
                // include new fields
                overviewVideoUrl: true,
                pdfUrl: true,
                explanatoryVideoUrl: true,
                challengeType: true,
                },
            },
            },
        },
        },
    });

    if (!path) throw new AppError(404, 'المسار غير موجود');
    return path;
};

export const createPath = async (data: any) => {
    return prisma.path.create({
        data: {
        title: data.title,
        titleEn: data.titleEn,
        description: data.description,
        descriptionEn: data.descriptionEn,
        categoryId: data.categoryId,
        difficulty: data.difficulty || 'BEGINNER',
        price: data.price ?? 0,
        currency: data.currency || 'EGP',
        featuredImage: data.featuredImage,
        tags: data.tags || [],
        prerequisites: data.prerequisites || [],
        estimatedDuration: data.estimatedDuration,
        isPublished: data.isPublished ?? false,
        isFeatured: data.isFeatured ?? false,
        },
        include: { category: true },
    });
};

export const updatePath = async (id: string, data: any) => {
    const path = await prisma.path.findUnique({ where: { id } });
    if (!path || path.deletedAt) throw new AppError(404, 'المسار غير موجود');

    return prisma.path.update({
        where: { id },
        data: {
        ...data,
        },
        include: { category: true },
    });
};

export const deletePath = async (id: string) => {
    const path = await prisma.path.findUnique({ where: { id } });
    if (!path || path.deletedAt) throw new AppError(404, 'المسار غير موجود');

    return prisma.path.update({
        where: { id },
        data: { deletedAt: new Date(), isPublished: false },
    });
};

export const publishPath = async (id: string, publish: boolean) => {
    const path = await prisma.path.findUnique({ where: { id } });
    if (!path || path.deletedAt) throw new AppError(404, 'المسار غير موجود');

    return prisma.path.update({
        where: { id },
        data: { isPublished: publish },
    });
};