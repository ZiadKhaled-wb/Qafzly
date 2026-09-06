import { z } from 'zod';

export const recommendationsQuerySchema = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(20).default(10),
        categoryId: z.string().uuid().optional(),
        difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS']).optional(),
    }),
});

export const relatedPathsParamsSchema = z.object({
    params: z.object({
        pathId: z.string().uuid(),
    }),
    query: z.object({
        limit: z.coerce.number().int().min(1).max(20).default(10),
    }),
});