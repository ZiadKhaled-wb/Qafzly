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

export const completeCheckpointSchema = z.object({
    params: z.object({
        lessonId: z.string().uuid(),
        checkpointId: z.string().uuid(),
    }),
    body: z.object({
        completed: z.boolean(),
        selfReflectionAnswer: z.string().optional(),
    }),
});

export const reorderCheckpointsSchema = z.object({
    body: z.object({
        orderedCheckpointIds: z.array(z.string().uuid()),
    }),
});