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

export const getUserByIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف المستخدم غير صالح'),
    }),
});

export const updateUserSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف المستخدم غير صالح'),
    }),
    body: z.object({
        role: z.enum(['STUDENT', 'PARENT', 'ADMIN']).optional(),
        isActive: z.boolean().optional(),
        isEmailVerified: z.boolean().optional(),
    }),
});

export const suspendUserSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف المستخدم غير صالح'),
    }),
    body: z.object({
        reason: z.string().min(1, 'سبب الإيقاف مطلوب').optional(),
    }),
});

export const activateUserSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف المستخدم غير صالح'),
    }),
});

/**
 * Dedicated schema for POST /admin/users/:id/role.
 * Kept separate from updateUserSchema so future changes to one don't
 * accidentally loosen the other. Role is required here (unlike updateUserSchema
 * where every field is optional).
 */
export const changeUserRoleSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف المستخدم غير صالح'),
    }),
    body: z.object({
        role: z.enum(['STUDENT', 'PARENT', 'ADMIN'], {
            error: 'الدور غير صالح',
        }),
    }),
});