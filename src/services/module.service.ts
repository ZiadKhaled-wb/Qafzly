import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const createModule = async (data: any) => {
    // Verify path exists
    const path = await prisma.path.findUnique({ where: { id: data.pathId } });
    if (!path) throw new AppError(404, 'الكورس غير موجود');

    return prisma.module.create({
        data,
        include: {
            path: { select: { id: true, title: true } },
        },
    });
};

export const listModulesByPath = async (pathId: string, params: any, includeUnpublished: boolean = false) => {
    const { page, limit, isPublished } = params;
    const skip = (page - 1) * limit;

    const where: any = { pathId };
    if (!includeUnpublished) {
        where.isPublished = true;
    } else if (isPublished !== undefined) {
        where.isPublished = isPublished;
    }

    const [modules, total] = await Promise.all([
        prisma.module.findMany({
            where,
            skip,
            take: limit,
            orderBy: { order: 'asc' },
            include: {
                _count: { select: { lessons: true } },
            },
        }),
        prisma.module.count({ where }),
    ]);

    return { modules, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getModuleById = async (id: string, includeUnpublished: boolean = false) => {
    const where: any = { id };
    if (!includeUnpublished) {
        where.isPublished = true;
    }

    const module = await prisma.module.findFirst({
        where,
        include: {
            path: { select: { id: true, title: true } },
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
    });
    if (!module) throw new AppError(404, 'الوحدة غير موجودة');
    return module;
};

export const updateModule = async (id: string, data: any) => {
    const module = await prisma.module.findUnique({ where: { id } });
    if (!module) throw new AppError(404, 'الوحدة غير موجودة');

    return prisma.module.update({
        where: { id },
        data,
    });
};

export const deleteModule = async (id: string) => {
    const module = await prisma.module.findUnique({ where: { id } });
    if (!module) throw new AppError(404, 'الوحدة غير موجودة');

    // Cascade delete lessons via Prisma relation
    return prisma.module.delete({ where: { id } });
};