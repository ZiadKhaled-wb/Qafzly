import { z } from 'zod';

export const listCertificatesQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
});

export const certificateIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف الشهادة غير صالح'),
    }),
});

export const certificateCodeParamSchema = z.object({
    params: z.object({
        code: z.string().min(6).max(32),
    }),
});

export const adminIssueCertificateSchema = z.object({
    body: z.object({
        userId: z.string().uuid('معرف المستخدم غير صالح'),
        pathId: z.string().uuid('معرف المسار غير صالح'),
    }),
});

export const revokeCertificateSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف الشهادة غير صالح'),
    }),
    body: z.object({
        reason: z.string().min(3, 'سبب الإلغاء مطلوب').max(500),
    }),
});