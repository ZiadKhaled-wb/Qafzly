import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as notificationController from '../controllers/notification.controller';
import {
    listNotificationsQuerySchema,
    markNotificationReadParamsSchema,
    registerDeviceSchema,
    unregisterDeviceParamsSchema,
} from '../utils/validators/notification.schema';

const router = Router();
router.use(authenticate);

router.get('/', validate(listNotificationsQuerySchema), notificationController.listNotifications);
router.get('/unread/count', notificationController.getUnreadCount);
router.post('/read-all', notificationController.markAllAsRead);
router.post('/:id/read', validate(markNotificationReadParamsSchema), notificationController.markAsRead);
router.delete('/:id', validate(markNotificationReadParamsSchema), notificationController.deleteNotification);
router.post('/device/register', validate(registerDeviceSchema), notificationController.registerDevice);
router.delete('/device/:id', validate(unregisterDeviceParamsSchema), notificationController.unregisterDevice);
router.post('/:id/archive', validate(markNotificationReadParamsSchema), notificationController.archiveNotification);
router.post('/:id/dismiss', validate(markNotificationReadParamsSchema), notificationController.dismissNotification);

export default router;