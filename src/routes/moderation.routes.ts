import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as moderationController from '../controllers/moderation.controller';
import {
    listReportsQuerySchema,
    resolveReportSchema,
} from '../utils/validators/forum.schema';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/reports', validate(listReportsQuerySchema), moderationController.listReports);
router.post('/reports/:id/resolve', validate(resolveReportSchema), moderationController.resolveReport);
router.post('/posts/:id/hide', moderationController.hidePost);
router.post('/posts/:id/unhide', moderationController.unhidePost);
router.post('/comments/:id/hide', moderationController.hideComment);
router.post('/comments/:id/unhide', moderationController.unhideComment);

export default router;