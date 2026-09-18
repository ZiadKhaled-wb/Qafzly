import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as recommendationService from '../services/recommendation.service';

export const getPersonalizedRecommendations = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const limit = parseInt(req.query.limit as string) || 10;
        const paths = await recommendationService.getPersonalizedRecommendations(
            userId,
            limit
        );
        return apiResponse(res, 200, paths, 'توصيات مخصصة لك');
    }
);

export const getPopularPaths = asyncHandler(
    async (req: Request, res: Response) => {
        const limit = parseInt(req.query.limit as string) || 10;
        const { categoryId, difficulty } = req.query as any;
        const paths = await recommendationService.getPopularPaths(limit, {
            categoryId,
            difficulty,
        });
        return apiResponse(res, 200, paths, 'الدورات الأكثر شعبية');
    }
);

export const getTrendingPaths = asyncHandler(
    async (req: Request, res: Response) => {
        const limit = parseInt(req.query.limit as string) || 10;
        const { categoryId, difficulty } = req.query as any;
        const paths = await recommendationService.getTrendingPaths(limit, {
            categoryId,
            difficulty,
        });
        return apiResponse(res, 200, paths, 'الدورات الرائجة');
    }
);

export const getRelatedPaths = asyncHandler(
    async (req: Request, res: Response) => {
        const pathId = req.params.pathId;
        const limit = parseInt(req.query.limit as string) || 10;
        const paths = await recommendationService.getRelatedPaths(
            pathId as string,
            limit
        );
        return apiResponse(res, 200, paths, 'دورات ذات صلة');
    }
);