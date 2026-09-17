import { z } from 'zod';

export const questCheckpointSchema = z.object({
    body: z.object({
        titleAr: z.string().min(1, 'العنوان مطلوب'),
        titleEn: z.string().optional(),
        taskAr: z.string().min(1, 'المهمة مطلوبة'),
        taskEn: z.string().optional(),
        hintAr: z.string().optional(),
        hintEn: z.string().optional(),
        xpAward: z.number().int().min(0).max(100).default(15),
        order: z.number().int().min(0).optional(),
    }),
});

export const updateCheckpointSchema = z.object({
    params: z.object({ checkpointId: z.string().uuid() }),
    body: questCheckpointSchema.shape.body.partial(),
});

/**
 * SECURITY: `.strict()` rejects unexpected fields. Intentional.
 *
 * Client sends only `selfReflectionAnswer`. Completion is determined
 * server-side by answerEvaluation.service.evaluateCheckpointSubmission().
 * The old `completed: boolean` field is gone — it was spoofable.
 */
export const completeCheckpointSchema = z.object({
    params: z.object({
        lessonId: z.string().uuid(),
        checkpointId: z.string().uuid(),
    }),
    body: z
        .object({
            selfReflectionAnswer: z.string().optional(),
        })
        .strict(),
});

export const reorderCheckpointsSchema = z.object({
    body: z.object({
        orderedCheckpointIds: z.array(z.string().uuid()),
    }),
});