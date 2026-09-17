import { z } from 'zod';
import { optionalBooleanQuery } from './booleanQuery';

export const listPathsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        categoryId: z.string().uuid().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).optional(),
        minPrice: z.coerce.number().optional(),
        maxPrice: z.coerce.number().optional(),
        isFeatured: optionalBooleanQuery,             // ← fixed
        sortBy: z.enum(['createdAt', 'price', 'title']).default('createdAt'),
        order: z.enum(['asc', 'desc']).default('desc'),
    }),
});

export const createPathSchema = z.object({
    body: z.object({
        title: z.string().min(1),
        titleEn: z.string().optional(),
        description: z.string().min(1),
        descriptionEn: z.string().optional(),
        categoryId: z.string().uuid().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).default('BEGINNER'),
        price: z.number().nonnegative().default(0),
        currency: z.string().default('EGP'),
        featuredImage: z.string().optional(),
        tags: z.array(z.string()).optional(),
        prerequisites: z.array(z.string()).optional(),
        estimatedDuration: z.number().int().min(0).optional(),
        isPublished: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
    }),
});

export const updatePathSchema = z.object({
    body: z.object({
        title: z.string().optional(),
        titleEn: z.string().nullable().optional(),
        description: z.string().optional(),
        descriptionEn: z.string().nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).optional(),
        price: z.number().nonnegative().optional(),
        currency: z.string().optional(),
        featuredImage: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        prerequisites: z.array(z.string()).optional(),
        estimatedDuration: z.number().int().min(0).optional(),
        isPublished: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
    }),
});

export const publishPathSchema = z.object({
    body: z.object({
        publish: z.boolean(),
    }),
});