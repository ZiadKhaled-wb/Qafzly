import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as lessonController from '../controllers/lesson.controller';
import {
    createLessonSchema,
    updateLessonSchema,
    listLessonsQuerySchema,
    lessonIdParamSchema,
} from '../utils/validators/lesson.schema';

const router = Router();

router.get('/', validate(listLessonsQuerySchema), lessonController.listLessons);
router.get('/:id', lessonController.getLesson);
router.get('/:id/lock-status', authenticate, validate(lessonIdParamSchema), lessonController.getLockStatus);
router.post('/', authenticate, authorize('ADMIN'), validate(createLessonSchema), lessonController.createLesson);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateLessonSchema), lessonController.updateLesson);
router.delete('/:id', authenticate, authorize('ADMIN'), lessonController.deleteLesson);

router.get('/:id/pdf-url', authenticate, lessonController.getPdfUrl);

export default router;