import { randomBytes } from 'crypto';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import * as emailService from './email.service';
import { PaymentRequestStatus } from '@prisma/client';

const VODAFONE_CASH_NUMBER = '01094811197';
const INSTAPAY_NUMBER = '01211721488';

// Crockford base32 alphabet — excludes I, L, O, U to prevent visual confusion
// with 0/1/2 and to stay consistent with the certificate code alphabet.
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REFERENCE_CODE_GROUPS = 3;
const REFERENCE_CODE_GROUP_LENGTH = 4;

/**
 * Generates a cryptographically-strong payment reference code.
 * Format: `QFZ-XXXX-XXXX-XXXX` (18 chars total, Crockford base32 body).
 * Collision space: 32^12 ≈ 1.15e18.
 */
const generateReferenceCode = (): string => {
    const totalChars = REFERENCE_CODE_GROUPS * REFERENCE_CODE_GROUP_LENGTH;
    const bytes = randomBytes(totalChars);
    let body = '';
    for (let i = 0; i < totalChars; i++) {
        if (i > 0 && i % REFERENCE_CODE_GROUP_LENGTH === 0) body += '-';
        body += CROCKFORD_ALPHABET[bytes[i] % CROCKFORD_ALPHABET.length];
    }
    return `QFZ-${body}`;
};

/**
 * Persists a payment request, retrying on the (astronomically unlikely) event
 * of a `referenceCode` unique-constraint collision. Returns both the persisted
 * row and the code that was actually used — the caller must return the code
 * from here, not a locally-generated one, or a retry would produce a mismatch
 * between the response and the DB.
 */
const persistPaymentRequest = async (params: {
    userId: string;
    pathId: string;
    amountCents: number;
    currency: string;
    paymentMethod: string;
    expiresAt: Date;
}) => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const referenceCode = generateReferenceCode();
        try {
            const request = await prisma.paymentRequest.create({
                data: {
                    userId: params.userId,
                    pathId: params.pathId,
                    amountCents: params.amountCents,
                    currency: params.currency,
                    referenceCode,
                    paymentMethod: params.paymentMethod,
                    status: PaymentRequestStatus.PENDING,
                    expiresAt: params.expiresAt,
                },
            });
            return { request, referenceCode };
        } catch (err: any) {
            // P2002 = unique constraint. `referenceCode` is the only unique
            // field we set at create time, so any P2002 here is a collision.
            if (err?.code === 'P2002' && attempt < 2) continue;
            throw err;
        }
    }
    // Unreachable — loop returns or throws on every iteration.
    throw new Error('Failed to persist payment request after 3 attempts');
};

const getPaymentInstructions = (referenceCode: string, amount: number) => {
    return [
        {
            method: 'vodafone_cash',
            displayName: 'فودافون كاش',
            number: VODAFONE_CASH_NUMBER,
            instructions: [
                'افتح تطبيق فودافون كاش',
                'اختر "تحويل أموال"',
                `أدخل الرقم: ${VODAFONE_CASH_NUMBER}`,
                `أدخل المبلغ: ${amount.toFixed(2)} جنيه`,
                `اكتب رمز المرجع في رسالة التحويل: ${referenceCode}`,
                'اضغط على "إرسال"',
                'ارجع إلى المنصة واضغط على "أكدت الدفع"',
            ],
        },
        {
            method: 'instapay',
            displayName: 'إنستا باي',
            number: INSTAPAY_NUMBER,
            instructions: [
                'افتح تطبيق إنستا باي',
                'اختر "تحويل"',
                `أدخل رقم الهاتف: ${INSTAPAY_NUMBER}`,
                `أدخل المبلغ: ${amount.toFixed(2)} جنيه`,
                `أضف رمز المرجع في البيان: ${referenceCode}`,
                'اضغط على "تأكيد"',
                'ارجع إلى المنصة واضغط على "أكدت الدفع"',
            ],
        },
    ];
};

export const createPaymentRequest = async (
    userId: string,
    pathId: string,
    paymentMethod: string = 'vodafone_cash'
) => {
    // Check path exists and is published
    const path = await prisma.path.findFirst({
        where: { id: pathId, isPublished: true, deletedAt: null },
    });
    if (!path) {
        throw new AppError(404, 'الدورة غير موجودة أو غير منشورة');
    }

    // Check if user already has an active enrollment for this path
    const existingEnrollment = await prisma.enrollment.findFirst({
        where: { userId, pathId, isActive: true },
    });
    if (existingEnrollment) {
        throw new AppError(409, 'أنت مسجل بالفعل في هذه الدورة');
    }

    const amountCents = Math.round(Number(path.price) * 100);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { request, referenceCode } = await persistPaymentRequest({
        userId,
        pathId,
        amountCents,
        currency: path.currency,
        paymentMethod,
        expiresAt,
    });

    // Send payment instructions email (non-throwing — see email.service.ts)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
        await emailService.sendPaymentInstructions(user.email, {
            pathName: path.title,
            amount: (amountCents / 100).toFixed(2),
            currency: path.currency,
            referenceCode,
            vodafoneNumber: VODAFONE_CASH_NUMBER,
            instapayNumber: INSTAPAY_NUMBER,
        });
    }

    return {
        requestId: request.id,
        referenceCode,
        // FIX (Sprint 13 / Task #9): return Decimal string, not number.
        amount: (amountCents / 100).toFixed(2),
        currency: path.currency,
        expiresAt,
        instructions: getPaymentInstructions(referenceCode, amountCents / 100),
    };
};

export const markPaymentAsSent = async (
    requestId: string,
    userId: string,
    userNotes?: string
) => {
    const request = await prisma.paymentRequest.findFirst({
        where: { id: requestId, userId },
    });
    if (!request) {
        throw new AppError(404, 'طلب الدفع غير موجود');
    }
    if (request.status !== PaymentRequestStatus.PENDING) {
        throw new AppError(422, 'لا يمكن تحديث هذا الطلب في حالته الحالية');
    }
    // Status intentionally stays PENDING — this only records the user's note.
    await prisma.paymentRequest.update({
        where: { id: requestId },
        data: { userNotes },
    });
    return { success: true };
};

export const listUserPaymentRequests = async (userId: string, params: any) => {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;
    const where: any = { userId };
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
        prisma.paymentRequest.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                path: { select: { id: true, title: true } },
            },
        }),
        prisma.paymentRequest.count({ where }),
    ]);

    return {
        requests,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

export const listAllPaymentRequests = async (params: any) => {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (search) {
        where.OR = [
            { referenceCode: { contains: search, mode: 'insensitive' } },
            { user: { fullName: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { path: { title: { contains: search, mode: 'insensitive' } } },
        ];
    }

    const [requests, total] = await Promise.all([
        prisma.paymentRequest.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, fullName: true, email: true } },
                path: { select: { id: true, title: true } },
                activatedBy: { select: { id: true, fullName: true } },
            },
        }),
        prisma.paymentRequest.count({ where }),
    ]);

    return {
        requests,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

export const activatePaymentRequest = async (
    requestId: string,
    adminId: string,
    durationMonths: number,
    adminNotes?: string
) => {
    const request = await prisma.paymentRequest.findUnique({
        where: { id: requestId },
        include: { path: true },
    });
    if (!request) {
        throw new AppError(404, 'طلب الدفع غير موجود');
    }
    if (
        request.status !== PaymentRequestStatus.PENDING &&
        request.status !== PaymentRequestStatus.VERIFIED
    ) {
        throw new AppError(422, 'لا يمكن تفعيل هذا الطلب في حالته الحالية');
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const result = await prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.paymentRequest.update({
            where: { id: requestId },
            data: {
                status: PaymentRequestStatus.ACTIVATED,
                activatedByUserId: adminId,
                activatedAt: now,
                subscriptionDurationMonths: durationMonths,
                adminNotes,
            },
        });

        await tx.purchase.create({
            data: {
                userId: request.userId,
                pathId: request.pathId,
                amount: request.amountCents / 100,
                currency: request.currency,
                status: 'COMPLETED',
                transactionId: request.referenceCode,
            },
        });

        // NOTE (Sprint 14 backlog): `create` will throw on a prior enrollment
        // for this (userId, pathId). Should be `upsert` — see HANDOFF §10.
        await tx.enrollment.create({
            data: {
                userId: request.userId,
                pathId: request.pathId,
                enrolledAt: now,
                expiresAt: endDate,
                isActive: true,
            },
        });

        return updatedRequest;
    });

    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    if (user) {
        await emailService.sendPaymentActivationConfirmation(user.email, {
            pathName: request.path.title,
            durationMonths,
            endDate: endDate.toISOString().split('T')[0],
        });
    }

    return result;
};

export const rejectPaymentRequest = async (
    requestId: string,
    adminId: string,
    reason: string
) => {
    const request = await prisma.paymentRequest.findUnique({
        where: { id: requestId },
    });
    if (!request) {
        throw new AppError(404, 'طلب الدفع غير موجود');
    }
    if (
        request.status !== PaymentRequestStatus.PENDING &&
        request.status !== PaymentRequestStatus.VERIFIED
    ) {
        throw new AppError(422, 'لا يمكن رفض هذا الطلب في حالته الحالية');
    }

    const updated = await prisma.paymentRequest.update({
        where: { id: requestId },
        data: {
            status: PaymentRequestStatus.REJECTED,
            rejectedReason: reason,
            rejectedAt: new Date(),
        },
    });

    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    if (user) {
        const path = await prisma.path.findUnique({
            where: { id: request.pathId },
        });
        await emailService.sendPaymentRejection(user.email, {
            pathName: path?.title || '',
            reason,
        });
    }

    return updated;
};