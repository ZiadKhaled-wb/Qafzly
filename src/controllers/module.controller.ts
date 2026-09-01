import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as moduleService from '../services/module.service';

export const createModule = asyncHandler(async (req: Request, res: Response) => {
    const module = await moduleService.createModule(req.body);
    return apiResponse(res, 201, module, 'تم إنشاء الوحدة بنجاح');
});

export const listModules = asyncHandler(async (req: Request, res: Response) => {
    const { courseId, page, limit, isPublished } = req.query as any;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const result = await moduleService.listModulesByCourse(courseId, { page, limit, isPublished }, isAdmin);
    return apiResponse(res, 200, result.modules, 'تم جلب الوحدات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getModule = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const module = await moduleService.getModuleById((req.params.id as string), isAdmin);
    return apiResponse(res, 200, module, 'تم جلب الوحدة');
});

export const updateModule = asyncHandler(async (req: Request, res: Response) => {
    const module = await moduleService.updateModule((req.params.id as string), req.body);
    return apiResponse(res, 200, module, 'تم تحديث الوحدة');
});

export const deleteModule = asyncHandler(async (req: Request, res: Response) => {
    await moduleService.deleteModule(req.params.id as string);
    return apiResponse(res, 200, null, 'تم حذف الوحدة');
});