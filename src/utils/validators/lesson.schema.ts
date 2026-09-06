import { z } from 'zod';
import { extractYouTubeId } from '../youtube';

export const listLessonsQuerySchema = z.object({
    query: z.object({
        moduleId: z.string().uuid(),
    }),
});

export const lessonIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const createLessonSchema = z.object({
    body: z.object({
        moduleId: z.string().uuid(),
        title: z.string().min(1),
        titleEn: z.string().optional(),
        content: z.string().optional(),
        contentEn: z.string().optional(),
        contentType: z.enum(['TEXT', 'VIDEO', 'QUIZ', 'CODE', 'MIXED']).default('TEXT'),
        videoUrl: z.string().optional(),
        videoDuration: z.number().int().min(0).optional(),
        hasQuiz: z.boolean().optional(),
        order: z.number().int().min(0).optional(),
        isPreview: z.boolean().optional(),
        isPublished: z.boolean().optional(),
        estimatedTime: z.number().int().min(0).optional(),
        overviewVideoUrl: z.string().optional().refine(
            (val) => !val || extractYouTubeId(val) !== null,
            { message: 'يجب أن يكون معرف يوتيوب صالح أو رابط يوتيوب' }
        ),
        pdfUrl: z.string().optional(),
        explanatoryVideoUrl: z.string().optional().refine(
            (val) => !val || extractYouTubeId(val) !== null,
            { message: 'يجب أن يكون معرف يوتيوب صالح أو رابط يوتيوب' }
        ),
        slidesJson: z.any().optional(),
        challengeDescription: z.string().optional(),
        challengeType: z.string().optional(),
        challengeData: z.any().optional(),
        lockDurationHours: z.number().int().min(0).max(48).optional().default(12),
    }),
});

export const updateLessonSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
        title: z.string().optional(),
        titleEn: z.string().nullable().optional(),
        content: z.string().nullable().optional(),
        contentEn: z.string().nullable().optional(),
        contentType: z.enum(['TEXT', 'VIDEO', 'QUIZ', 'CODE', 'MIXED']).optional(),
        videoUrl: z.string().nullable().optional(),
        videoDuration: z.number().int().min(0).optional(),
        hasQuiz: z.boolean().optional(),
        order: z.number().int().min(0).optional(),
        isPreview: z.boolean().optional(),
        isPublished: z.boolean().optional(),
        estimatedTime: z.number().int().min(0).optional(),
        overviewVideoUrl: z.string().nullable().optional(),
        pdfUrl: z.string().nullable().optional(),
        explanatoryVideoUrl: z.string().nullable().optional(),
        slidesJson: z.any().optional(),
        challengeDescription: z.string().nullable().optional(),
        challengeType: z.string().optional(),
        challengeData: z.any().optional(),
        lockDurationHours: z.number().int().min(0).max(48).optional(),
    }),
});