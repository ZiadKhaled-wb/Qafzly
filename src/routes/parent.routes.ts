import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as parentController from '../controllers/parent.controller';
import {
    addChildSchema,
    childIdParamSchema,
    updateChildSettingsSchema,
} from '../utils/validators/parent.schema';

const router = Router();

// All parent routes require authentication and PARENT role
router.use(authenticate, authorize('PARENT'));

router.post('/me/children', validate(addChildSchema), parentController.addChild);
router.get('/me/children', parentController.listChildren);
router.delete('/me/children/:childId', validate(childIdParamSchema), parentController.removeChild);
router.get('/me/children/:childId/progress', validate(childIdParamSchema), parentController.getChildProgress);
router.get('/me/children/:childId/performance', validate(childIdParamSchema), parentController.getChildPerformance);
router.get('/me/children/:childId/time-tracking', validate(childIdParamSchema), parentController.getChildTimeTracking);
router.get('/me/children/:childId/settings', validate(childIdParamSchema), parentController.getChildSettings);
router.put('/me/children/:childId/settings', validate(updateChildSettingsSchema), parentController.updateChildSettings);
router.get('/me/overview', parentController.getOverview);
router.get('/me/billing', parentController.getBilling);

export default router;