import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

interface Pagination {
    page: number;
    limit: number;
}

interface SearchFilters {
    q: string;
    language?: 'ar' | 'en';
    type?: 'course' | 'forum' | 'user';
    categoryId?: string;
    difficulty?: string;
    minPrice?: number;
    maxPrice?: number;
    courseId?: string; // for forum search
}

export const globalSearch = async (
        filters: SearchFilters,
        pagination: Pagination
    ) => {
    const types = filters.type ? [filters.type] : ['course', 'forum', 'user'];
    const result: any = {};

    if (types.includes('course')) {
        result.courses = await searchCourses(filters, pagination);
    }
    if (types.includes('forum')) {
        result.posts = await searchForumPosts(filters, pagination);
    }
    if (types.includes('user')) {
        result.users = await searchUsers(filters, pagination);
    }

    return result;
    };

    export const searchCourses = async (
    filters: SearchFilters,
    pagination: Pagination
    ) => {
    const { q, language = 'ar', categoryId, difficulty, minPrice, maxPrice } = filters;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // Use full-text search with rank; fallback to ILIKE for short queries
    const searchCondition = q.length >= 3
        ? Prisma.sql`("search_vector_${Prisma.raw(language === 'ar' ? 'ar' : 'en')}" @@ websearch_to_tsquery(${language}, ${q}))`
        : Prisma.sql`("title" ILIKE ${`%${q}%`} OR "title_en" ILIKE ${`%${q}%`} OR "description" ILIKE ${`%${q}%`} OR "description_en" ILIKE ${`%${q}%`})`;

    const where = Prisma.sql`
        "deletedAt" IS NULL
        AND "isPublished" = true
        AND (${searchCondition})
        ${categoryId ? Prisma.sql`AND "categoryId" = ${categoryId}` : Prisma.empty}
        ${difficulty ? Prisma.sql`AND "difficulty" = ${difficulty}::"CourseDifficulty"` : Prisma.empty}
        ${minPrice !== undefined ? Prisma.sql`AND "price" >= ${minPrice}` : Prisma.empty}
        ${maxPrice !== undefined ? Prisma.sql`AND "price" <= ${maxPrice}` : Prisma.empty}
    `;

    const courses = await prisma.$queryRaw`
        SELECT
        *,
        CASE
            WHEN ${q.length >= 3} THEN ts_rank("search_vector_${Prisma.raw(language === 'ar' ? 'ar' : 'en')}", websearch_to_tsquery(${language}, ${q}))
            ELSE 0.1
        END AS rank
        FROM "courses"
        WHERE ${where}
        ORDER BY rank DESC, "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
    `;

    const total = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM "courses" WHERE ${where}
    `;

    return {
        data: courses,
        pagination: {
        page,
        limit,
        total: total[0]?.count ?? 0,
        totalPages: Math.ceil((total[0]?.count ?? 0) / limit),
        },
    };
};

export const searchForumPosts = async (
        filters: SearchFilters,
        pagination: Pagination
    ) => {
    const { q, language = 'ar', categoryId, courseId } = filters;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const searchCondition = q.length >= 3
        ? Prisma.sql`("search_vector_${Prisma.raw(language === 'ar' ? 'ar' : 'en')}" @@ websearch_to_tsquery(${language}, ${q}))`
        : Prisma.sql`("title" ILIKE ${`%${q}%`} OR "content" ILIKE ${`%${q}%`})`;

    const where = Prisma.sql`
        "deletedAt" IS NULL
        AND "status" = 'published'
        AND (${searchCondition})
        ${categoryId ? Prisma.sql`AND "categoryId" = ${categoryId}` : Prisma.empty}
        ${courseId ? Prisma.sql`AND "courseId" = ${courseId}` : Prisma.empty}
    `;

    const posts = await prisma.$queryRaw`
        SELECT
        *,
        CASE
            WHEN ${q.length >= 3} THEN ts_rank("search_vector_${Prisma.raw(language === 'ar' ? 'ar' : 'en')}", websearch_to_tsquery(${language}, ${q}))
            ELSE 0.1
        END AS rank
        FROM "forum_posts"
        WHERE ${where}
        ORDER BY rank DESC, "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
    `;

    const total = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM "forum_posts" WHERE ${where}
    `;

    return {
        data: posts,
        pagination: {
        page,
        limit,
        total: total[0]?.count ?? 0,
        totalPages: Math.ceil((total[0]?.count ?? 0) / limit),
        },
    };
};

export const searchUsers = async (
        filters: SearchFilters,
        pagination: Pagination
    ) => {
    const { q } = filters;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const users = await prisma.user.findMany({
        where: {
        OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
        ],
        deletedAt: null,
        },
        select: {
        id: true,
        fullName: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        role: true,
        isPublic: true,
        },
        skip: offset,
        take: limit,
        orderBy: { fullName: 'asc' },
    });

    const total = await prisma.user.count({
        where: {
        OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
        ],
        deletedAt: null,
        },
    });

    return {
        data: users,
        pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        },
    };
};