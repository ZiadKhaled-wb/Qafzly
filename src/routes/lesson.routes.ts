import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { optionalAuth } from '../middleware/optionalAuth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as lessonController from '../controllers/lesson.controller';
import {
    createLessonSchema,
    updateLessonSchema,
    listLessonsQuerySchema,
    lessonIdParamSchema,
} from '../utils/validators/lesson.schema';
import { uploadPdf } from '../utils/uploadPdf';

const router = Router();

// Public endpoints — optional auth enriches the response for logged-in users.
// Non-enrolled/anonymous users see only lessons with `isPreview: true`; the
// detail endpoint enforces that rule and returns 403 otherwise.
router.get('/', optionalAuth, validate(listLessonsQuerySchema), lessonController.listLessons);
router.get('/:id', optionalAuth, lessonController.getLesson);

router.get('/:id/lock-status', authenticate, validate(lessonIdParamSchema), lessonController.getLockStatus);
router.post('/', authenticate, authorize('ADMIN'), validate(createLessonSchema), lessonController.createLesson);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateLessonSchema), lessonController.updateLesson);
router.delete('/:id', authenticate, authorize('ADMIN'), lessonController.deleteLesson);

// PDF URL (authenticated, enrolled student or parent)
router.get('/:id/pdf-url', authenticate, lessonController.getPdfUrl);

// Upload PDF (admin)
router.post('/:id/pdf', authenticate, authorize('ADMIN'), uploadPdf, lessonController.uploadPdf);

// Delete PDF (admin)
router.delete('/:id/pdf', authenticate, authorize('ADMIN'), lessonController.deletePdf);

router.get('/:id/recharge-status', authenticate, lessonController.getRechargeStatus);

export default router;