import { z } from 'zod';

export const createCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1, 'اسم التصنيف مطلوب'),
        nameEn: z.string().optional(),
        description: z.string().optional(),
        parentId: z.string().uuid('معرف التصنيف الأب غير صالح').optional(),
    }),
});

export const updateCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1).optional(),
        nameEn: z.string().optional(),
        description: z.string().optional(),
        parentId: z.string().uuid().optional(),
    }),
});

export const listCategoriesQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        parentId: z.string().uuid().optional(),
    }),
});