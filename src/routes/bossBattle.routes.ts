import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as bossBattleController from '../controllers/bossBattle.controller';
import {
    bossBattleSchema,
    submitBossBattleSchema,
    getBossBattleSchema,
} from '../utils/validators/bossBattle.schema';

const router = Router();

// Admin routes
router.post('/modules/:moduleId/boss-battle', authenticate, authorize('ADMIN'), validate(bossBattleSchema), bossBattleController.createBossBattle);
router.put('/modules/:moduleId/boss-battle/:battleId', authenticate, authorize('ADMIN'), validate(bossBattleSchema), bossBattleController.updateBossBattle);
router.delete('/modules/:moduleId/boss-battle/:battleId', authenticate, authorize('ADMIN'), bossBattleController.deleteBossBattle);

// User routes
router.get('/modules/:moduleId/boss-battle', authenticate, validate(getBossBattleSchema), bossBattleController.getBossBattle);
router.post('/modules/:moduleId/boss-battle/submit', authenticate, validate(submitBossBattleSchema), bossBattleController.submitBossBattle);

export default router;