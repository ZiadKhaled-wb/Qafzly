import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as searchService from '../services/search.service';

export const globalSearch = asyncHandler(async (req: Request, res: Response) => {
    const { q, language, type, categoryId, difficulty, minPrice, maxPrice, page, limit } = req.query as any;
    const result = await searchService.globalSearch(
        { q, language, type, categoryId, difficulty, minPrice, maxPrice },
        { page, limit }
    );
    return apiResponse(res, 200, result, 'نتائج البحث');
});

export const searchPaths = asyncHandler(async (req: Request, res: Response) => {
    const { q, language, categoryId, difficulty, minPrice, maxPrice, page, limit } = req.query as any;
    const result = await searchService.searchPaths(
        { q, language, categoryId, difficulty, minPrice, maxPrice },
        { page, limit }
    );
    return apiResponse(res, 200, result, 'نتائج البحث في الدورات');
});

export const searchForum = asyncHandler(async (req: Request, res: Response) => {
    const { q, language, categoryId, pathId, page, limit } = req.query as any;
    const result = await searchService.searchForumPosts(
        { q, language, categoryId, pathId },
        { page, limit }
    );
    return apiResponse(res, 200, result, 'نتائج البحث في المنتدى');
});

export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
    const { q, page, limit } = req.query as any;
    const result = await searchService.searchUsers(
        { q },
        { page, limit }
    );
    return apiResponse(res, 200, result, 'نتائج البحث عن المستخدمين');
});