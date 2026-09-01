import { z } from 'zod';

export const getXpHistorySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

export const getLeaderboardSchema = z.object({
    query: z.object({
        scope: z.enum(['global', 'course']).default('global'),
        courseId: z.string().uuid().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

export const getStreakSchema = z.object({
    params: z.object({
        userId: z.string().uuid().optional(),
    }),
});

export const completeQuestSchema = z.object({
    params: z.object({
        questId: z.string().uuid(),
    }),
});