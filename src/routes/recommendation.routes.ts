import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as recommendationController from '../controllers/recommendation.controller';
import {
    recommendationsQuerySchema,
    relatedCoursesParamsSchema,
} from '../utils/validators/recommendation.schema';

const router = Router();

// Public endpoints
router.get('/popular', validate(recommendationsQuerySchema), recommendationController.getPopularCourses);
router.get('/trending', validate(recommendationsQuerySchema), recommendationController.getTrendingCourses);
router.get('/related/:courseId', validate(relatedCoursesParamsSchema), recommendationController.getRelatedCourses);

// Authenticated endpoints
router.get('/courses', authenticate, validate(recommendationsQuerySchema), recommendationController.getPersonalizedRecommendations);

export default router;