import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as courseController from '../controllers/course.controller';
import {
    createCourseSchema,
    updateCourseSchema,
    listCoursesQuerySchema,
} from '../utils/validators/course.schema';

const router = Router();

// Public routes
router.get('/', validate(listCoursesQuerySchema), courseController.listCoursesPublic);
router.get('/:id', courseController.getCourse);

// Admin routes
router.post('/', authenticate, authorize('ADMIN'), validate(createCourseSchema), courseController.createCourse);
router.get('/admin/list', authenticate, authorize('ADMIN'), validate(listCoursesQuerySchema), courseController.listCoursesAdmin);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateCourseSchema), courseController.updateCourse);
router.delete('/:id', authenticate, authorize('ADMIN'), courseController.deleteCourse);
router.post('/:id/publish', authenticate, authorize('ADMIN'), courseController.publishCourse);

export default router;