import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as userController from '../controllers/user.controller';
import { uploadAvatar } from '../utils/upload';
import {
    updateProfileSchema,
    updateProfilePartialSchema,
    updatePrivacySchema,
} from '../utils/validators/user.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/me', userController.getMe);
router.put('/me', validate(updateProfileSchema), userController.updateMe);
router.patch('/me', validate(updateProfilePartialSchema), userController.patchMe);
router.delete('/me', userController.deleteMe);

router.post('/me/avatar', uploadAvatar, userController.uploadAvatar);
router.delete('/me/avatar', userController.removeAvatar);

router.put('/me/privacy', validate(updatePrivacySchema), userController.updatePrivacy);
router.get('/me/privacy', userController.getPrivacy);

export default router;