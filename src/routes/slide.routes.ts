import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as slideController from '../controllers/slide.controller';
import {
    createSlideSchema,
    updateSlideSchema,
    completeSlideSchema,
    reorderSlidesSchema,
} from '../utils/validators/slide.schema';

const router = Router();

// Admin routes
router.post('/lessons/:lessonId/slides', authenticate, authorize('ADMIN'), validate(createSlideSchema), slideController.createSlide);
router.put('/lessons/:lessonId/slides/:slideId', authenticate, authorize('ADMIN'), validate(updateSlideSchema), slideController.updateSlide);
router.delete('/lessons/:lessonId/slides/:slideId', authenticate, authorize('ADMIN'), slideController.deleteSlide);
router.post('/lessons/:lessonId/slides/reorder', authenticate, authorize('ADMIN'), validate(reorderSlidesSchema), slideController.reorderSlides);

// User routes
router.post('/lessons/:lessonId/slides/:slideId/complete', authenticate, validate(completeSlideSchema), slideController.completeSlide);

export default router;