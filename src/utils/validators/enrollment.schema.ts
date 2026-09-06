import { z } from 'zod';

export const enrollPathSchema = z.object({
    params: z.object({
        pathId: z.string().uuid('معرف الكورس مطلوب'),
    }),
});

export const listUserEnrollmentsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

export const listPathEnrollmentsQuerySchema = z.object({
    params: z.object({
        pathId: z.string().uuid('معرف الكورس مطلوب'),
    }),
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});