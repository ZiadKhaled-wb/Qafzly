import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as paymentRequestService from '../services/payment.service';

export const createPaymentRequest = asyncHandler(async (req: Request, res: Response) => {
    const { pathId, paymentMethod } = req.body;
    const userId = (req as any).user.userId;
    const result = await paymentRequestService.createPaymentRequest(userId, pathId, paymentMethod);
    return apiResponse(res, 201, result, 'تم إنشاء طلب الدفع بنجاح');
});

export const markPaymentAsSent = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userNotes } = req.body;
    const userId = (req as any).user.userId;
    await paymentRequestService.markPaymentAsSent((id as string), userId, userNotes);
    return apiResponse(res, 200, null, 'تم تحديث حالة الدفع');
});

export const listUserPaymentRequests = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { page, limit, status } = req.query as any;
    const result = await paymentRequestService.listUserPaymentRequests(userId, { page, limit, status });
    return apiResponse(res, 200, result.requests, 'تم جلب طلبات الدفع', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const listAllPaymentRequests = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status, search } = req.query as any;
    const result = await paymentRequestService.listAllPaymentRequests({ page, limit, status, search });
    return apiResponse(res, 200, result.requests, 'تم جلب طلبات الدفع', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const activatePaymentRequest = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { subscriptionDurationMonths, adminNotes } = req.body;
    const adminId = (req as any).user.userId;
    const result = await paymentRequestService.activatePaymentRequest((id as string), adminId, subscriptionDurationMonths, adminNotes);
    return apiResponse(res, 200, result, 'تم تفعيل الاشتراك بنجاح');
});

export const rejectPaymentRequest = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user.userId;
    const result = await paymentRequestService.rejectPaymentRequest((id as string), adminId, reason);
    return apiResponse(res, 200, result, 'تم رفض طلب الدفع');
});