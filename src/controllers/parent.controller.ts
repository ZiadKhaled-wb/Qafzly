import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as parentService from '../services/parent.service';

export const addChild = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const { childId } = req.body;
    const child = await parentService.addChild(parentUserId, childId);
    return apiResponse(res, 200, child, 'تم ربط الطفل بنجاح');
});

export const removeChild = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const childId = req.params.childId;
    await parentService.removeChild(parentUserId, (childId as string));
    return apiResponse(res, 200, null, 'تم إلغاء الربط');
});

export const listChildren = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const children = await parentService.listChildren(parentUserId);
    return apiResponse(res, 200, children, 'تم جلب الأطفال');
});

export const getChildProgress = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const childId = req.params.childId;
    const progress = await parentService.getChildProgress(parentUserId, (childId as string));
    return apiResponse(res, 200, progress, 'تم جلب تقدم الطفل');
});

export const getChildPerformance = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const childId = req.params.childId;
    const performance = await parentService.getChildPerformance(parentUserId, (childId as string));
    return apiResponse(res, 200, performance, 'تم جلب أداء الطفل');
});

export const getChildTimeTracking = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const childId = req.params.childId;
    const time = await parentService.getChildTimeTracking(parentUserId, (childId as string));
    return apiResponse(res, 200, time, 'تم جلب تتبع الوقت');
});

export const getChildSettings = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const childId = req.params.childId;
    const settings = await parentService.getChildSettings(parentUserId, (childId as string));
    return apiResponse(res, 200, settings, 'تم جلب الإعدادات');
});

export const updateChildSettings = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const childId = req.params.childId;
    const settings = await parentService.updateChildSettings(parentUserId, (childId as string), req.body);
    return apiResponse(res, 200, settings, 'تم تحديث الإعدادات');
});

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const overview = await parentService.getParentOverview(parentUserId);
    return apiResponse(res, 200, overview, 'نظرة عامة');
});

export const getBilling = asyncHandler(async (req: Request, res: Response) => {
    const parentUserId = (req as any).user.userId;
    const billing = await parentService.getBilling(parentUserId);
    return apiResponse(res, 200, billing, 'بيانات الفوترة');
});