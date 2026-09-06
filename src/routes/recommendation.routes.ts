import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as recommendationController from '../controllers/recommendation.controller';
import {
    recommendationsQuerySchema,
    relatedPathsParamsSchema,
} from '../utils/validators/recommendation.schema';

const router = Router();

// Public endpoints
router.get('/popular', validate(recommendationsQuerySchema), recommendationController.getPopularPaths);
router.get('/trending', validate(recommendationsQuerySchema), recommendationController.getTrendingPaths);
router.get('/related/:pathId', validate(relatedPathsParamsSchema), recommendationController.getRelatedPaths);

// Authenticated endpoints
router.get('/paths', authenticate, validate(recommendationsQuerySchema), recommendationController.getPersonalizedRecommendations);

export default router;