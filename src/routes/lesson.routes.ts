import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as lessonController from '../controllers/lesson.controller';
import {
    createLessonSchema,
    updateLessonSchema,
    listLessonsQuerySchema,
} from '../utils/validators/lesson.schema';

const router = Router();

// Public routes
router.get('/', validate(listLessonsQuerySchema), lessonController.listLessons);
router.get('/:id', lessonController.getLesson);

// Admin routes
router.post('/', authenticate, authorize('ADMIN'), validate(createLessonSchema), lessonController.createLesson);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateLessonSchema), lessonController.updateLesson);
router.delete('/:id', authenticate, authorize('ADMIN'), lessonController.deleteLesson);

export default router;