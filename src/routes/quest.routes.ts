import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as questController from '../controllers/quest.controller';
import {
    questCheckpointSchema,
    updateCheckpointSchema,
    completeCheckpointSchema,
    reorderCheckpointsSchema,
} from '../utils/validators/questCheckpoint.schema';

const router = Router();

router.post('/lessons/:lessonId/checkpoints', authenticate, authorize('ADMIN'), validate(questCheckpointSchema), questController.createCheckpoint);
router.put('/lessons/:lessonId/checkpoints/:checkpointId', authenticate, authorize('ADMIN'), validate(updateCheckpointSchema), questController.updateCheckpoint);
router.delete('/lessons/:lessonId/checkpoints/:checkpointId', authenticate, authorize('ADMIN'), questController.deleteCheckpoint);
router.post('/lessons/:lessonId/checkpoints/reorder', authenticate, authorize('ADMIN'), validate(reorderCheckpointsSchema), questController.reorderCheckpoints);
router.post('/lessons/:lessonId/checkpoints/:checkpointId/complete', authenticate, validate(completeCheckpointSchema), questController.completeCheckpoint);

export default router;