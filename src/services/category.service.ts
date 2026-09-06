import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const createCategory = async (data: any) => {
    return prisma.courseCategory.create({
        data,
    });
};

export const listCategories = async (params: any) => {
    const { page, limit, search, parentId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { nameEn: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (parentId) where.parentId = parentId;

    const [categories, total] = await Promise.all([
        prisma.courseCategory.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { paths: true, children: true } },
            },
        }),
        prisma.courseCategory.count({ where }),
    ]);

    return { categories, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getCategoryById = async (id: string) => {
    const category = await prisma.courseCategory.findUnique({
        where: { id },
        include: {
            children: true,
            paths: {
                where: { isPublished: true, deletedAt: null },
                select: { id: true, title: true, featuredImage: true, price: true, difficulty: true },
            },
        },
    });
    if (!category) throw new AppError(404, 'التصنيف غير موجود');
    return category;
};

export const updateCategory = async (id: string, data: any) => {
    const category = await prisma.courseCategory.findUnique({ where: { id } });
    if (!category) throw new AppError(404, 'التصنيف غير موجود');

    return prisma.courseCategory.update({
        where: { id },
        data,
    });
};

export const deleteCategory = async (id: string) => {
    const category = await prisma.courseCategory.findUnique({ where: { id } });
    if (!category) throw new AppError(404, 'التصنيف غير موجود');

    // Set paths categoryId to null and children parentId to null before delete
    await prisma.$transaction([
        prisma.path.updateMany({
            where: { categoryId: id },
            data: { categoryId: null },
        }),
        prisma.courseCategory.updateMany({
            where: { parentId: id },
            data: { parentId: null },
        }),
        prisma.courseCategory.delete({ where: { id } }),
    ]);
};