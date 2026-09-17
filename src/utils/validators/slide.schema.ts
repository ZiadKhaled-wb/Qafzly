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

/**
 * SECURITY: `.strict()` rejects unexpected fields. Intentional.
 *
 * Client sends only `answer`. Correctness is computed server-side by
 * answerEvaluation.service.evaluateSlideAnswer(). Any attempt to send
 * `isCorrect` (or other injected fields) fails validation with 400.
 *
 * If you need to add fields, add them explicitly — do NOT remove .strict().
 */
export const completeSlideSchema = z.object({
    params: z.object({
        lessonId: z.string().uuid(),
        slideId: z.string().uuid(),
    }),
    body: z
        .object({
            answer: z.any().optional(),
        })
        .strict(),
});

export const reorderSlidesSchema = z.object({
    body: z.object({
        orderedSlideIds: z.array(z.string().uuid()),
    }),
});