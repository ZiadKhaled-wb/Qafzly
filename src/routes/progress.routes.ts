import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as progressController from '../controllers/progress.controller';
import {
    updateProgressSchema,
    getCourseProgressSchema,
} from '../utils/validators/progress.schema';

const router = Router();

// User routes (requires auth)
router.post('/lessons/:lessonId', authenticate, validate(updateProgressSchema), progressController.updateProgress);
router.get('/courses/:courseId', authenticate, validate(getCourseProgressSchema), progressController.getCourseProgress);

export default router;