import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as courseService from '../services/course.service';

export const createCourse = asyncHandler(async (req: Request, res: Response) => {
    const course = await courseService.createCourse(req.body);
    return apiResponse(res, 201, course, 'تم إنشاء الكورس بنجاح');
});

export const listCoursesPublic = asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as any;
    const result = await courseService.listCourses(params, false);
    return apiResponse(res, 200, result.courses, 'تم جلب الكورسات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const listCoursesAdmin = asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as any;
    const result = await courseService.listCourses(params, true);
    return apiResponse(res, 200, result.courses, 'تم جلب الكورسات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getCourse = asyncHandler(async (req: Request, res: Response) => {
    // If admin, can include unpublished
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const course = await courseService.getCourseById((req.params.id as string), isAdmin);
    return apiResponse(res, 200, course, 'تم جلب الكورس');
});

export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
    const course = await courseService.updateCourse((req.params.id as string), req.body);
    return apiResponse(res, 200, course, 'تم تحديث الكورس');
});

export const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
    await courseService.deleteCourse(req.params.id as string);
    return apiResponse(res, 200, null, 'تم حذف الكورس');
});

export const publishCourse = asyncHandler(async (req: Request, res: Response) => {
    const { publish } = req.body;
    const course = await courseService.publishCourse((req.params.id as string), publish);
    return apiResponse(res, 200, course, publish ? 'تم نشر الكورس' : 'تم إلغاء نشر الكورس');
});