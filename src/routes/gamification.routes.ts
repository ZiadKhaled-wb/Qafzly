import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as gamificationController from '../controllers/gamification.controller';
import {
    getXpHistorySchema,
    getLeaderboardSchema,
    completeQuestSchema,
} from '../utils/validators/gamification.schema';

const router = Router();

// Public routes (no auth)
router.get('/levels', gamificationController.getLevels);
router.get('/badges', gamificationController.getBadges);

// Auth required routes
router.use(authenticate);
router.get('/me', gamificationController.getMyProfile);
router.get('/users/:userId', gamificationController.getUserProfile); // maybe public? but keep auth for now
router.get('/xp/history', validate(getXpHistorySchema), gamificationController.getXpHistory);
router.get('/me/badges', gamificationController.getMyBadges);
router.get('/users/:userId/badges', gamificationController.getUserBadges);
router.get('/leaderboard', validate(getLeaderboardSchema), gamificationController.getLeaderboard);
router.get('/me/streak', gamificationController.getMyStreak);
router.get('/daily-quests', gamificationController.getDailyQuests);
router.post('/daily-quests/:questId/complete', validate(completeQuestSchema), gamificationController.completeDailyQuest);
router.post('/me/streak/freeze', gamificationController.freezeStreak);

export default router;