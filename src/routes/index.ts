import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import courseRoutes from './course.routes';
import moduleRoutes from './module.routes';
import lessonRoutes from './lesson.routes';
import progressRoutes from './progress.routes';
import gamificationRoutes from './gamification.routes';
import forumRoutes from './forum.routes';
import moderationRoutes from './moderation.routes';
import notificationRoutes from './notification.routes';
import adminRoutes from './admin.routes';
import paymentRoutes from './payment.routes';
import searchRoutes from './search.routes';
import recommendationRoutes from './recommendation.routes';


const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/courses', courseRoutes);
router.use('/modules', moduleRoutes);
router.use('/lessons', lessonRoutes);
router.use('/progress', progressRoutes);
router.use('/gamification', gamificationRoutes);
router.use('/forum', forumRoutes);
router.use('moderation', moderationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/payment', paymentRoutes);
router.use('/search', searchRoutes);
router.use('/recommendations', recommendationRoutes);

export default router;