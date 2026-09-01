import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import * as moderationController from '../controllers/moderation.controller';

const router = Router();

// All moderation routes require admin
router.use(authenticate, authorize('ADMIN'));

router.get('/reports', moderationController.listReports);
router.post('/reports/:id/resolve', moderationController.resolveReport);
router.post('/posts/:id/hide', moderationController.hidePost);
router.post('/posts/:id/unhide', moderationController.unhidePost);
router.post('/comments/:id/hide', moderationController.hideComment);
router.post('/comments/:id/unhide', moderationController.unhideComment);

export default router;