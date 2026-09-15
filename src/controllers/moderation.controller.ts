import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as moderationService from '../services/moderation.service';

export const hidePost = asyncHandler(async (req: Request, res: Response) => {
    await moderationService.hidePost(req.params.id as string);
    return apiResponse(res, 200, null, 'تم إخفاء المنشور');
});

export const unhidePost = asyncHandler(async (req: Request, res: Response) => {
    await moderationService.unhidePost(req.params.id as string);
    return apiResponse(res, 200, null, 'تم إظهار المنشور');
});

export const hideComment = asyncHandler(async (req: Request, res: Response) => {
    await moderationService.hideComment(req.params.id as string);
    return apiResponse(res, 200, null, 'تم إخفاء التعليق');
});

export const unhideComment = asyncHandler(async (req: Request, res: Response) => {
    await moderationService.unhideComment(req.params.id as string);
    return apiResponse(res, 200, null, 'تم إظهار التعليق');
});

export const listReports = asyncHandler(async (req: Request, res: Response) => {
    const result = await moderationService.listReports(req.query);
    return apiResponse(res, 200, result.reports, 'تم جلب البلاغات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const resolveReport = asyncHandler(async (req: Request, res: Response) => {
    await moderationService.resolveReport(req.params.id as string, (req as any).user.userId);
    return apiResponse(res, 200, null, 'تم معالجة البلاغ');
});