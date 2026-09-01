import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as lessonService from '../services/lesson.service';

export const createLesson = asyncHandler(async (req: Request, res: Response) => {
    const lesson = await lessonService.createLesson(req.body);
    return apiResponse(res, 201, lesson, 'تم إنشاء الدرس بنجاح');
});

export const listLessons = asyncHandler(async (req: Request, res: Response) => {
    const { moduleId, page, limit, isPublished } = req.query as any;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const result = await lessonService.listLessonsByModule(moduleId, { page, limit, isPublished }, isAdmin);
    return apiResponse(res, 200, result.lessons, 'تم جلب الدروس', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getLesson = asyncHandler(async (req: Request, res: Response) => {
    const lesson = await lessonService.getLessonById(req.params.id as string);
    return apiResponse(res, 200, lesson, 'تم جلب الدرس');
});

export const updateLesson = asyncHandler(async (req: Request, res: Response) => {
    const lesson = await lessonService.updateLesson((req.params.id as string), req.body);
    return apiResponse(res, 200, lesson, 'تم تحديث الدرس');
});

export const deleteLesson = asyncHandler(async (req: Request, res: Response) => {
    await lessonService.deleteLesson(req.params.id as string);
    return apiResponse(res, 200, null, 'تم حذف الدرس');
});