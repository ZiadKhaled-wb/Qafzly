import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as categoryController from '../controllers/category.controller';
import {
    createCategorySchema,
    updateCategorySchema,
    listCategoriesQuerySchema,
} from '../utils/validators/category.schema';

const router = Router();

// Public routes
router.get('/', validate(listCategoriesQuerySchema), categoryController.listCategories);
router.get('/:id', categoryController.getCategory);

// Admin routes
router.post('/', authenticate, authorize('ADMIN'), validate(createCategorySchema), categoryController.createCategory);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateCategorySchema), categoryController.updateCategory);
router.delete('/:id', authenticate, authorize('ADMIN'), categoryController.deleteCategory);

export default router;