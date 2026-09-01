import { z } from 'zod';

export const enrollCourseSchema = z.object({
    params: z.object({
        courseId: z.string().uuid('معرف الكورس مطلوب'),
    }),
});

export const listUserEnrollmentsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

export const listCourseEnrollmentsQuerySchema = z.object({
    params: z.object({
        courseId: z.string().uuid('معرف الكورس مطلوب'),
    }),
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});