import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as enrollmentController from '../controllers/enrollment.controller';
import {
    enrollPathSchema,
    listUserEnrollmentsQuerySchema,
    listPathEnrollmentsQuerySchema,
} from '../utils/validators/enrollment.schema';

const router = Router();

// User routes (requires auth)
router.post('/paths/:pathId/enroll', authenticate, validate(enrollPathSchema), enrollmentController.enroll);
router.delete('/paths/:pathId/enroll', authenticate, validate(enrollPathSchema), enrollmentController.unenroll);
router.get('/me/enrollments', authenticate, validate(listUserEnrollmentsQuerySchema), enrollmentController.myEnrollments);

// Admin routes
router.get('/paths/:pathId/enrollments', authenticate, authorize('ADMIN'), validate(listPathEnrollmentsQuerySchema), enrollmentController.pathEnrollments);

export default router;