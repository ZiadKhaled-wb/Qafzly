import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import * as emailService from './email.service';
import { PaymentRequestStatus } from '@prisma/client';

const VODAFONE_CASH_NUMBER = '01094811197';
const INSTAPAY_NUMBER = '01211721488';

const generateReferenceCode = (userId: string, pathId: string) => {
    const part1 = userId.slice(0, 8).toUpperCase();
    const part2 = pathId.slice(0, 8).toUpperCase();
    const timestamp = Date.now().toString(36);
    return `PAY-${part1}-${part2}-${timestamp}`;
};

export const createPaymentRequest = async (userId: string, pathId: string, paymentMethod: string = 'vodafone_cash') => {
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
    const referenceCode = generateReferenceCode(userId, pathId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const paymentRequest = await prisma.paymentRequest.create({
        data: {
        userId,
        pathId,
        amountCents,
        currency: path.currency,
        referenceCode,
        paymentMethod,
        status: PaymentRequestStatus.PENDING,
        expiresAt,
        },
    });

    // Send payment instructions email
    await emailService.sendPaymentInstructions(
        (await prisma.user.findUnique({ where: { id: userId } }))!.email,
        {
        pathName: path.title,
        amount: (amountCents / 100).toFixed(2),
        currency: path.currency,
        referenceCode,
        vodafoneNumber: VODAFONE_CASH_NUMBER,
        instapayNumber: INSTAPAY_NUMBER,
        }
    );

    return {
        requestId: paymentRequest.id,
        referenceCode,
        amount: amountCents / 100,
        currency: path.currency,
        expiresAt,
        instructions: getPaymentInstructions(referenceCode, amountCents / 100),
    };
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

export const markPaymentAsSent = async (requestId: string, userId: string, userNotes?: string) => {
    const request = await prisma.paymentRequest.findFirst({
        where: { id: requestId, userId },
    });
    if (!request) {
        throw new AppError(404, 'طلب الدفع غير موجود');
    }
    if (request.status !== PaymentRequestStatus.PENDING) {
        throw new AppError(422, 'لا يمكن تحديث هذا الطلب في حالته الحالية');
    }
    // Keep status as PENDING; we'll just update userNotes and maybe add a flag (optional)
    await prisma.paymentRequest.update({
        where: { id: requestId },
        data: {
        userNotes,
        },
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

    return { requests, total, page, limit, totalPages: Math.ceil(total / limit) };
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

    return { requests, total, page, limit, totalPages: Math.ceil(total / limit) };
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
    if (request.status !== PaymentRequestStatus.PENDING && request.status !== PaymentRequestStatus.VERIFIED) {
        throw new AppError(422, 'لا يمكن تفعيل هذا الطلب في حالته الحالية');
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
        // Update payment request
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

        // Create Purchase record (one-time)
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

        // Create Enrollment with expiry
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

    // Send activation email
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

export const rejectPaymentRequest = async (requestId: string, adminId: string, reason: string) => {
    const request = await prisma.paymentRequest.findUnique({
        where: { id: requestId },
    });
    if (!request) {
        throw new AppError(404, 'طلب الدفع غير موجود');
    }
    if (request.status !== PaymentRequestStatus.PENDING && request.status !== PaymentRequestStatus.VERIFIED) {
        throw new AppError(422, 'لا يمكن رفض هذا الطلب في حالته الحالية');
    }

    const updated = await prisma.paymentRequest.update({
        where: { id: requestId },
        data: {
        status: PaymentRequestStatus.REJECTED,
        rejectedReason: reason,
        rejectedAt: new Date(),
        // adminNotes? could keep separate
        },
    });

    // Send rejection email
    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    if (user) {
        await emailService.sendPaymentRejection(user.email, {
        pathName: (await prisma.path.findUnique({ where: { id: request.pathId } }))?.title || '',
        reason,
        });
    }

    return updated;
};