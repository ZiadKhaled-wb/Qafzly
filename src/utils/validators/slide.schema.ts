import { z } from 'zod';

export const createSlideSchema = z.object({
    body: z.object({
        slideType: z.enum(['INFO', 'QUIZ', 'DRAG_DROP', 'TRUE_FALSE', 'FILL_BLANK']),
        titleAr: z.string().optional(),
        titleEn: z.string().optional(),
        bodyAr: z.string().optional(),
        bodyEn: z.string().optional(),
        questionAr: z.string().optional(),
        questionEn: z.string().optional(),
        optionsJson: z.array(z.string()).optional(),
        correctIndex: z.number().int().min(0).optional(),
        explanationAr: z.string().optional(),
        explanationEn: z.string().optional(),
        instructionAr: z.string().optional(),
        instructionEn: z.string().optional(),
        itemsJson: z.array(z.object({
        label: z.string(),
        correctZone: z.string(),
        })).optional(),
        statementAr: z.string().optional(),
        statementEn: z.string().optional(),
        correctAnswer: z.boolean().optional(),
        sentenceAr: z.string().optional(),
        sentenceEn: z.string().optional(),
        acceptedAnswersJson: z.array(z.string()).optional(),
        xpAward: z.number().int().min(0).max(50).default(5),
        order: z.number().int().min(0).optional(),
    }),
});

export const updateSlideSchema = z.object({
    params: z.object({ slideId: z.string().uuid() }),
    body: createSlideSchema.shape.body.partial(),
});

export const completeSlideSchema = z.object({
    params: z.object({
        lessonId: z.string().uuid(),
        slideId: z.string().uuid(),
    }),
    body: z.object({
        answer: z.any().optional(),
        isCorrect: z.boolean(),
    }),
});

export const reorderSlidesSchema = z.object({
    body: z.object({
        orderedSlideIds: z.array(z.string().uuid()),
    }),
});