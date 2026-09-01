import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as enrollmentController from '../controllers/enrollment.controller';
import {
    enrollCourseSchema,
    listUserEnrollmentsQuerySchema,
    listCourseEnrollmentsQuerySchema,
} from '../utils/validators/enrollment.schema';

const router = Router();

// User routes (requires auth)
router.post('/courses/:courseId/enroll', authenticate, validate(enrollCourseSchema), enrollmentController.enroll);
router.delete('/courses/:courseId/enroll', authenticate, validate(enrollCourseSchema), enrollmentController.unenroll);
router.get('/me/enrollments', authenticate, validate(listUserEnrollmentsQuerySchema), enrollmentController.myEnrollments);

// Admin routes
router.get('/courses/:courseId/enrollments', authenticate, authorize('ADMIN'), validate(listCourseEnrollmentsQuerySchema), enrollmentController.courseEnrollments);

export default router;