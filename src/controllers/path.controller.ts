import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as pathService from '../services/path.service';

export const listPaths = asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as any;
    const result = await pathService.listPaths(params);
    return apiResponse(res, 200, result.paths, 'تم جلب المسارات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const listAllPathsAdmin = asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as any;
    const result = await pathService.listAllPathsAdmin(params);
    return apiResponse(res, 200, result.paths, 'تم جلب جميع المسارات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getPath = asyncHandler(async (req: Request, res: Response) => {
    const includeUnpublished = (req as any).user?.role === 'ADMIN';
    const path = await pathService.getPathById((req.params.id as string), includeUnpublished);
    return apiResponse(res, 200, path, 'تم جلب المسار');
});

export const createPath = asyncHandler(async (req: Request, res: Response) => {
    const path = await pathService.createPath(req.body);
    return apiResponse(res, 201, path, 'تم إنشاء المسار');
});

export const updatePath = asyncHandler(async (req: Request, res: Response) => {
    const path = await pathService.updatePath((req.params.id as string), req.body);
    return apiResponse(res, 200, path, 'تم تحديث المسار');
});

export const deletePath = asyncHandler(async (req: Request, res: Response) => {
    await pathService.deletePath((req.params.id as string));
    return apiResponse(res, 200, null, 'تم حذف المسار');
});

export const publishPath = asyncHandler(async (req: Request, res: Response) => {
    const { publish } = req.body;
    const path = await pathService.publishPath((req.params.id as string), publish);
    return apiResponse(res, 200, path, publish ? 'تم نشر المسار' : 'تم إلغاء نشر المسار');
});