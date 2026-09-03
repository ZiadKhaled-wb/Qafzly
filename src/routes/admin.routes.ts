import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as adminController from '../controllers/admin.controller';
import * as notificationController from '../controllers/notification.controller';
import { adminSendNotificationSchema } from '../utils/validators/notification.schema';
import {
    listUsersQuerySchema,
    updateUserSchema,
    suspendUserSchema,
} from '../utils/validators/admin.schema';

const router = Router();

// All admin routes require ADMIN role
router.use(authenticate, authorize('ADMIN'));

router.get('/users', validate(listUsersQuerySchema), adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id', validate(updateUserSchema), adminController.updateUser);
router.post('/users/:id/suspend', validate(suspendUserSchema), adminController.suspendUser);
router.post('/users/:id/activate', adminController.activateUser);
router.post('/users/:id/role', adminController.changeRole);

router.post('/notifications', validate(adminSendNotificationSchema), notificationController.sendSystemNotification);

export default router;