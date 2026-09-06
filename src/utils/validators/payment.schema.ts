import { z } from 'zod';

export const createPaymentRequestSchema = z.object({
    body: z.object({
        pathId: z.string().uuid(),
        paymentMethod: z.enum(['vodafone_cash', 'instapay', 'bank_transfer']).optional(),
    }),
});

export const markPaymentSentSchema = z.object({
    body: z.object({
        userNotes: z.string().max(500).optional(),
    }),
});

export const listPaymentRequestsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        status: z.enum(['PENDING', 'VERIFIED', 'ACTIVATED', 'REJECTED', 'EXPIRED']).optional(),
        search: z.string().optional(),
    }),
});

export const activatePaymentRequestSchema = z.object({
    body: z.object({
        subscriptionDurationMonths: z.number().int().min(1).max(12).default(1),
        adminNotes: z.string().max(500).optional(),
    }),
});

export const rejectPaymentRequestSchema = z.object({
    body: z.object({
        reason: z.string().min(1, 'سبب الرفض مطلوب').max(500),
    }),
});