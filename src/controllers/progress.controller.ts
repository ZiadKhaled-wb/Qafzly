import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as progressService from '../services/progress.service';

export const updateProgress = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { lessonId } = req.params;
    const progress = await progressService.updateLessonProgress(userId, (lessonId as string), req.body);
    return apiResponse(res, 200, progress, 'تم تحديث التقدم');
});

export const getCourseProgress = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { courseId } = req.params;
    const progress = await progressService.getCourseProgress(userId, (courseId as string));
    return apiResponse(res, 200, progress, 'تم جلب التقدم');
});