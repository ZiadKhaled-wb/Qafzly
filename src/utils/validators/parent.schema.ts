import { z } from 'zod';

/**
 * Accepts EITHER `childId` (uuid) OR `email` — exactly one, not both.
 *
 * The `.refine()` uses `Boolean(A) !== Boolean(B)` which is true only when
 * exactly one of the two is provided. Both → false, neither → false.
 */
export const addChildSchema = z.object({
    body: z
        .object({
            childId: z.string().uuid('معرف الطفل غير صالح').optional(),
            email: z.string().email('البريد الإلكتروني غير صالح').optional(),
        })
        .refine(
            (data) => Boolean(data.childId) !== Boolean(data.email),
            { message: 'قدم childId أو email (واحد فقط)' }
        ),
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