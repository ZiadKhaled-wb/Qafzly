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

export const getPathProgressSchema = z.object({
    params: z.object({
        pathId: z.string().uuid('معرف الكورس مطلوب'),
    }),
});

export const completeWarmUpSchema = z.object({
    params: z.object({
        lessonId: z.string().uuid('معرف الدرس غير صالح'),
    }),
    body: z
        .object({
            answer: z.string().min(1, 'الإجابة مطلوبة'),
        })
        .strict(),
});