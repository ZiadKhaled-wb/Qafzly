import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as lessonService from '../services/lesson.service';
import * as pdfService from '../services/pdf.service';

export const listLessons = asyncHandler(async (req: Request, res: Response) => {
    const moduleId = req.query.moduleId as string;
    const lessons = await lessonService.listLessons(moduleId);
    return apiResponse(res, 200, lessons, 'تم جلب الدروس');
});

export const getLesson = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const lesson = await lessonService.getLessonById((req.params.id as string), userId);
    return apiResponse(res, 200, lesson, 'تم جلب الدرس');
});

export const createLesson = asyncHandler(async (req: Request, res: Response) => {
    const lesson = await lessonService.createLesson(req.body);
    return apiResponse(res, 201, lesson, 'تم إنشاء الدرس');
});

export const updateLesson = asyncHandler(async (req: Request, res: Response) => {
    const lesson = await lessonService.updateLesson((req.params.id as string), req.body);
    return apiResponse(res, 200, lesson, 'تم تحديث الدرس');
});

export const deleteLesson = asyncHandler(async (req: Request, res: Response) => {
    await lessonService.deleteLesson(req.params.id as string);
    return apiResponse(res, 200, null, 'تم حذف الدرس');
});

export const getLockStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const status = await lessonService.getLessonLockStatus((req.params.id as string), userId);
    return apiResponse(res, 200, status, 'حالة القفل');
});

export const getPdfUrl = asyncHandler(async (req: Request, res: Response) => {
    const result = await pdfService.getSignedPdfUrl(req.params.id as string);
    return apiResponse(res, 200, result, 'رابط PDF');
});