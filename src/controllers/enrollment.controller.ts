import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as enrollmentService from '../services/enrollment.service';

export const enroll = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { pathId } = req.params;
    const enrollment = await enrollmentService.enrollUser(userId, (pathId as string));
    return apiResponse(res, 201, enrollment, 'تم التسجيل في الكورس بنجاح');
});

export const unenroll = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { pathId } = req.params;
    const enrollment = await enrollmentService.unenrollUser(userId, (pathId as string));
    return apiResponse(res, 200, enrollment, 'تم إلغاء التسجيل من الكورس');
});

export const myEnrollments = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { page, limit } = req.query as any;
    const result = await enrollmentService.listUserEnrollments(userId, { page, limit });
    return apiResponse(res, 200, result.enrollments, 'تم جلب تسجيلاتك', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const pathEnrollments = asyncHandler(async (req: Request, res: Response) => {
    const { pathId } = req.params;
    const { page, limit } = req.query as any;
    const result = await enrollmentService.listPathEnrollments((pathId as string), { page, limit });
    return apiResponse(res, 200, result.enrollments, 'تم جلب المسجلين', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});