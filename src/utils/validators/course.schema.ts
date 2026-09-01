import { z } from 'zod';

export const createCourseSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'عنوان الكورس مطلوب'),
        titleEn: z.string().optional(),
        description: z.string().min(1, 'وصف الكورس مطلوب'),
        descriptionEn: z.string().optional(),
        categoryId: z.string().uuid().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).default('BEGINNER'),
        price: z.number().min(0).default(0),
        currency: z.string().default('EGP'),
        featuredImage: z.string().optional(),
        tags: z.array(z.string()).default([]),
        prerequisites: z.array(z.string()).default([]),
        estimatedDuration: z.number().int().min(0).default(0),
    }),
});

export const updateCourseSchema = z.object({
    body: z.object({
        title: z.string().min(1).optional(),
        titleEn: z.string().optional(),
        description: z.string().min(1).optional(),
        descriptionEn: z.string().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).optional(),
        price: z.number().min(0).optional(),
        currency: z.string().optional(),
        featuredImage: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        prerequisites: z.array(z.string()).optional(),
        estimatedDuration: z.number().int().min(0).optional(),
        isPublished: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
    }),
});

export const listCoursesQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        categoryId: z.string().uuid().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).optional(),
        minPrice: z.coerce.number().min(0).optional(),
        maxPrice: z.coerce.number().min(0).optional(),
        isPublished: z.coerce.boolean().optional(),
        isFeatured: z.coerce.boolean().optional(),
        sortBy: z.enum(['createdAt', 'price', 'title']).default('createdAt'),
        order: z.enum(['asc', 'desc']).default('desc'),
    }),
});