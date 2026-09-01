import { z } from 'zod';

export const updateProgressSchema = z.object({
    params: z.object({
        lessonId: z.string().uuid('معرف الدرس مطلوب'),
    }),
    body: z.object({
        completed: z.boolean().optional(),
        timeSpent: z.number().int().min(0).optional(),
        quizScore: z.number().int().min(0).max(100).optional(),
    }),
});

export const getCourseProgressSchema = z.object({
    params: z.object({
        courseId: z.string().uuid('معرف الكورس مطلوب'),
    }),
});