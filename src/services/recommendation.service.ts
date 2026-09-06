import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

interface RecommendationFilters {
    categoryId?: string;
    difficulty?: string;
}

export const getPopularPaths = async (
        limit: number,
        filters: RecommendationFilters = {}
    ) => {
    const where: any = {
        deletedAt: null,
        isPublished: true,
    };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.difficulty) where.difficulty = filters.difficulty;

    const paths = await prisma.path.findMany({
        where,
        orderBy: {
        enrollments: {
            _count: 'desc',
        },
        },
        take: limit,
        include: {
        category: true,
        },
    });
    return paths;
};

export const getTrendingPaths = async (limit: number) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trending = await prisma.$queryRaw<any[]>`
        SELECT
        p.*,
        COUNT(e.id) AS recent_enrollments
        FROM "paths" p
        JOIN "enrollments" e ON e."pathId" = p.id
        WHERE e."enrolledAt" >= ${thirtyDaysAgo}
        AND p."deletedAt" IS NULL
        AND p."isPublished" = true
        GROUP BY p.id
        ORDER BY recent_enrollments DESC, p."createdAt" DESC
        LIMIT ${limit}
    `;

    return trending;
};

export const getPersonalizedRecommendations = async (
        userId: string,
        limit: number
    ) => {
    const userEnrollments = await prisma.enrollment.findMany({
        where: { userId, isActive: true },
        select: { path: { select: { categoryId: true, difficulty: true } } },
    });

    const categoryIds = [...new Set(userEnrollments.map(e => e.path.categoryId).filter(Boolean))] as string[];

    if (categoryIds.length === 0) {
        return getPopularPaths(limit);
    }

    const enrolledPathIds = (
        await prisma.enrollment.findMany({
        where: { userId },
        select: { pathId: true },
        })
    ).map(e => e.pathId);

    const recommended = await prisma.path.findMany({
        where: {
        categoryId: { in: categoryIds },
        id: { notIn: enrolledPathIds },
        deletedAt: null,
        isPublished: true,
        },
        orderBy: {
        enrollments: {
            _count: 'desc',
        },
        },
        take: limit,
    });

    if (recommended.length < limit) {
        const popular = await getPopularPaths(limit - recommended.length);
        const recommendedIds = new Set(recommended.map(p => p.id));
        const fillers = popular.filter(p => !recommendedIds.has(p.id));
        return [...recommended, ...fillers].slice(0, limit);
    }

    return recommended;
};

export const getRelatedPaths = async (
        pathId: string,
        limit: number
    ) => {
    const related = await prisma.$queryRaw<any[]>`
        SELECT
        p2.*,
        COUNT(e2."userId") AS co_enrollment_count
        FROM "enrollments" e1
        JOIN "enrollments" e2 ON e2."userId" = e1."userId"
        JOIN "paths" p2 ON p2.id = e2."pathId"
        WHERE e1."pathId" = ${pathId}
        AND e2."pathId" != ${pathId}
        AND p2."deletedAt" IS NULL
        AND p2."isPublished" = true
        GROUP BY p2.id
        ORDER BY co_enrollment_count DESC, p2."createdAt" DESC
        LIMIT ${limit}
    `;

    return related;
};