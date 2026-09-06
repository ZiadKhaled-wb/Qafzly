import { z } from 'zod';

export const listUsersQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        role: z.enum(['STUDENT', 'PARENT', 'ADMIN']).optional(),
        status: z.enum(['active', 'suspended', 'deleted']).optional(),
    }),
});

export const updateUserSchema = z.object({
    body: z.object({
        role: z.enum(['STUDENT', 'PARENT', 'ADMIN']).optional(),
        isActive: z.boolean().optional(),
        isEmailVerified: z.boolean().optional(),
    }),
});

export const suspendUserSchema = z.object({
    body: z.object({
        reason: z.string().min(1, 'سبب الإيقاف مطلوب').optional(),
    }),
});