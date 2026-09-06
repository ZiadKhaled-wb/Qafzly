import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as pathController from '../controllers/path.controller';
import {
    listPathsQuerySchema,
    createPathSchema,
    updatePathSchema,
    publishPathSchema,
} from '../utils/validators/path.schema';

const router = Router();

router.get('/', validate(listPathsQuerySchema), pathController.listPaths);
router.get('/admin/list', authenticate, authorize('ADMIN'), pathController.listAllPathsAdmin);
router.get('/:id', pathController.getPath);
router.post('/', authenticate, authorize('ADMIN'), validate(createPathSchema), pathController.createPath);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updatePathSchema), pathController.updatePath);
router.delete('/:id', authenticate, authorize('ADMIN'), pathController.deletePath);
router.post('/:id/publish', authenticate, authorize('ADMIN'), validate(publishPathSchema), pathController.publishPath);

export default router;