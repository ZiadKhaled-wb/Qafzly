import { z } from 'zod';

export const searchQuerySchema = z.object({
    query: z.object({
        q: z.string().min(1, 'Search query required'),
        language: z.enum(['ar', 'en']).optional(),
        type: z.enum(['course', 'forum', 'user']).optional(),
        categoryId: z.string().uuid().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).optional(),
        minPrice: z.coerce.number().nonnegative().optional(),
        maxPrice: z.coerce.number().nonnegative().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
});

export const searchCoursesQuerySchema = z.object({
    query: z.object({
        q: z.string().min(1),
        language: z.enum(['ar', 'en']).optional(),
        categoryId: z.string().uuid().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).optional(),
        minPrice: z.coerce.number().nonnegative().optional(),
        maxPrice: z.coerce.number().nonnegative().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
});

export const searchForumQuerySchema = z.object({
    query: z.object({
        q: z.string().min(1),
        language: z.enum(['ar', 'en']).optional(),
        categoryId: z.string().uuid().optional(),
        courseId: z.string().uuid().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
});

export const searchUsersQuerySchema = z.object({
    query: z.object({
        q: z.string().min(1),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
});