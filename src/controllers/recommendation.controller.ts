import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as recommendationService from '../services/recommendation.service';

export const getPersonalizedRecommendations = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 10;
    const courses = await recommendationService.getPersonalizedRecommendations(userId, limit);
    return apiResponse(res, 200, courses, 'توصيات مخصصة لك');
});

export const getPopularCourses = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const { categoryId, difficulty } = req.query as any;
    const courses = await recommendationService.getPopularCourses(limit, { categoryId, difficulty });
    return apiResponse(res, 200, courses, 'الدورات الأكثر شعبية');
});

export const getTrendingCourses = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const courses = await recommendationService.getTrendingCourses(limit);
    return apiResponse(res, 200, courses, 'الدورات الرائجة');
});

export const getRelatedCourses = asyncHandler(async (req: Request, res: Response) => {
    const courseId = req.params.courseId;
    const limit = parseInt(req.query.limit as string) || 10;
    const courses = await recommendationService.getRelatedCourses((courseId as string), limit);
    return apiResponse(res, 200, courses, 'دورات ذات صلة');
});