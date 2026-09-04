import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

interface RecommendationFilters {
    categoryId?: string;
    difficulty?: string;
}

export const getPopularCourses = async (
        limit: number,
        filters: RecommendationFilters = {}
    ) => {
    const where: any = {
        deletedAt: null,
        isPublished: true,
    };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.difficulty) where.difficulty = filters.difficulty;

    const courses = await prisma.course.findMany({
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
    return courses;
};

export const getTrendingCourses = async (limit: number) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const trending = await prisma.$queryRaw<any[]>`
            SELECT
            c.*,
            COUNT(e.id) AS recent_enrollments
            FROM "courses" c
            JOIN "enrollments" e ON e."courseId" = c.id
            WHERE e."enrolledAt" >= ${thirtyDaysAgo}
            AND c."deletedAt" IS NULL
            AND c."isPublished" = true
            GROUP BY c.id
            ORDER BY recent_enrollments DESC, c."createdAt" DESC
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
        select: { course: { select: { categoryId: true, difficulty: true } } },
    });

    const categoryIds = [...new Set(userEnrollments.map(e => e.course.categoryId).filter(Boolean))] as string[];

    if (categoryIds.length === 0) {
        return getPopularCourses(limit);
    }

    const enrolledCourseIds = (
        await prisma.enrollment.findMany({
        where: { userId },
        select: { courseId: true },
        })
    ).map(e => e.courseId);

    const recommended = await prisma.course.findMany({
        where: {
        categoryId: { in: categoryIds },
        id: { notIn: enrolledCourseIds },
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
        const popular = await getPopularCourses(limit - recommended.length);
        const recommendedIds = new Set(recommended.map(c => c.id));
        const fillers = popular.filter(c => !recommendedIds.has(c.id));
        return [...recommended, ...fillers].slice(0, limit);
    }

    return recommended;
};

export const getRelatedCourses = async (
        courseId: string,
        limit: number
    ) => {
    const related = await prisma.$queryRaw<any[]>`
        SELECT
        c2.*,
        COUNT(e2."userId") AS co_enrollment_count
        FROM "enrollments" e1
        JOIN "enrollments" e2 ON e2."userId" = e1."userId"
        JOIN "courses" c2 ON c2.id = e2."courseId"
        WHERE e1."courseId" = ${courseId}
        AND e2."courseId" != ${courseId}
        AND c2."deletedAt" IS NULL
        AND c2."isPublished" = true
        GROUP BY c2.id
        ORDER BY co_enrollment_count DESC, c2."createdAt" DESC
        LIMIT ${limit}
    `;

    return related;
};