import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as progressController from '../controllers/progress.controller';
import {
    updateProgressSchema,
    getPathProgressSchema,
} from '../utils/validators/progress.schema';

const router = Router();

// User routes (requires auth)
router.post('/lessons/:lessonId', authenticate, validate(updateProgressSchema), progressController.updateProgress);
router.get('/paths/:pathId', authenticate, validate(getPathProgressSchema), progressController.getPathProgress);

export default router;