import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import pathRoutes from './path.routes';
import moduleRoutes from './module.routes';
import lessonRoutes from './lesson.routes';
import enrollmentRoutes from './enrollment.routes';
import progressRoutes from './progress.routes';

import gamificationRoutes from './gamification.routes';
import forumRoutes from './forum.routes';
import moderationRoutes from './moderation.routes';
import notificationRoutes from './notification.routes';
import adminRoutes from './admin.routes';
import paymentRoutes from './payment.routes';
import searchRoutes from './search.routes';
import recommendationRoutes from './recommendation.routes';
import parentRoutes from './parent.routes';
import slideRoutes from './slide.routes';
import questRoutes from './quest.routes';
import bossBattleRoutes from './bossBattle.routes';



const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/paths', pathRoutes);
router.use('/modules', moduleRoutes);
router.use('/lessons', lessonRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/progress', progressRoutes);
router.use('/gamification', gamificationRoutes);
router.use('/forum', forumRoutes);
router.use('moderation', moderationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/search', searchRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/parents', parentRoutes);
router.use('/', slideRoutes);
router.use('/', questRoutes);
router.use('/', bossBattleRoutes);


export default router;