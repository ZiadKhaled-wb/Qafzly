import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as moduleController from '../controllers/module.controller';
import {
    createModuleSchema,
    updateModuleSchema,
    listModulesQuerySchema,
} from '../utils/validators/module.schema';

const router = Router();

// Public routes (list modules for a path)
router.get('/', validate(listModulesQuerySchema), moduleController.listModules);
router.get('/:id', moduleController.getModule);

// Admin routes
router.post('/', authenticate, authorize('ADMIN'), validate(createModuleSchema), moduleController.createModule);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateModuleSchema), moduleController.updateModule);
router.delete('/:id', authenticate, authorize('ADMIN'), moduleController.deleteModule);

export default router;