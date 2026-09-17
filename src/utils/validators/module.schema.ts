import { z } from 'zod';
import { optionalBooleanQuery } from './booleanQuery';

export const createModuleSchema = z.object({
    body: z.object({
        pathId: z.string().uuid('معرف الكورس مطلوب'),
        title: z.string().min(1, 'عنوان الوحدة مطلوب'),
        titleEn: z.string().optional(),
        description: z.string().optional(),
        order: z.number().int().min(0).default(0),
        isPublished: z.boolean().default(false),
    }),
});

export const updateModuleSchema = z.object({
    body: z.object({
        title: z.string().min(1).optional(),
        titleEn: z.string().optional(),
        description: z.string().optional(),
        order: z.number().int().min(0).optional(),
        isPublished: z.boolean().optional(),
    }),
});

export const listModulesQuerySchema = z.object({
    query: z.object({
        pathId: z.string().uuid().optional(),
        isPublished: optionalBooleanQuery,            // ← fixed
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});