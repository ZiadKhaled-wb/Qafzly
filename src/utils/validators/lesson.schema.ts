import { z } from 'zod';

export const createLessonSchema = z.object({
    body: z.object({
        moduleId: z.string().uuid('معرف الوحدة مطلوب'),
        title: z.string().min(1, 'عنوان الدرس مطلوب'),
        titleEn: z.string().optional(),
        content: z.string().optional(),
        contentEn: z.string().optional(),
        contentType: z.enum(['TEXT', 'VIDEO', 'QUIZ', 'CODE', 'MIXED']).default('TEXT'),
        videoUrl: z.string().optional(),
        videoDuration: z.number().int().min(0).default(0),
        hasQuiz: z.boolean().default(false),
        order: z.number().int().min(0).default(0),
        isPreview: z.boolean().default(false),
        isPublished: z.boolean().default(false),
        estimatedTime: z.number().int().min(0).default(0),
    }),
});

export const updateLessonSchema = z.object({
    body: z.object({
        title: z.string().min(1).optional(),
        titleEn: z.string().optional(),
        content: z.string().optional(),
        contentEn: z.string().optional(),
        contentType: z.enum(['TEXT', 'VIDEO', 'QUIZ', 'CODE', 'MIXED']).optional(),
        videoUrl: z.string().optional(),
        videoDuration: z.number().int().min(0).optional(),
        hasQuiz: z.boolean().optional(),
        order: z.number().int().min(0).optional(),
        isPreview: z.boolean().optional(),
        isPublished: z.boolean().optional(),
        estimatedTime: z.number().int().min(0).optional(),
    }),
});

export const listLessonsQuerySchema = z.object({
    query: z.object({
        moduleId: z.string().uuid('معرف الوحدة مطلوب'),
        isPublished: z.coerce.boolean().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});