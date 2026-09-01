import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as categoryService from '../services/category.service';

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.createCategory(req.body);
    return apiResponse(res, 201, category, 'تم إنشاء التصنيف بنجاح');
});

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, parentId } = req.query as any;
    const result = await categoryService.listCategories({ page, limit, search, parentId });
    return apiResponse(res, 200, result.categories, 'تم جلب التصنيفات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.getCategoryById(req.params.id as string);
    return apiResponse(res, 200, category, 'تم جلب التصنيف');
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.updateCategory((req.params.id as string), req.body);
    return apiResponse(res, 200, category, 'تم تحديث التصنيف');
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    await categoryService.deleteCategory(req.params.id as string);
    return apiResponse(res, 200, null, 'تم حذف التصنيف');
});