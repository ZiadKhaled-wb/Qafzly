import { z } from 'zod';

export const addChildSchema = z.object({
    body: z.object({
        childId: z.string().uuid(),
    }),
});

export const childIdParamSchema = z.object({
    params: z.object({
        childId: z.string().uuid(),
    }),
});

export const updateChildSettingsSchema = z.object({
    params: z.object({
        childId: z.string().uuid(),
    }),
    body: z.object({
        lockOverrideEnabled: z.boolean().optional(),
        customLockDurationHours: z.number().int().min(0).max(24).nullable().optional(),
    }),
});