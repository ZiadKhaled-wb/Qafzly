import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as notificationService from '../services/notification.service';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { page, limit, isRead, isArchived, isDismissed, type } = req.query as any;
    const result = await notificationService.listNotifications(
        userId,
        { isRead, isArchived, isDismissed, type },
        { page, limit }
    );
    return apiResponse(res, 200, result.notifications, 'تم جلب الإشعارات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const count = await notificationService.getUnreadCount(userId);
    return apiResponse(res, 200, { count }, 'عدد الإشعارات غير المقروءة');
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const notification = await notificationService.markAsRead((req.params.id as string), userId);
    return apiResponse(res, 200, notification, 'تم تحديد الإشعار كمقروء');
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const count = await notificationService.markAllAsRead(userId);
    return apiResponse(res, 200, { count }, 'تم تحديد جميع الإشعارات كمقروءة');
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    await notificationService.deleteNotification((req.params.id as string), userId);
    return apiResponse(res, 200, null, 'تم حذف الإشعار');
});

export const registerDevice = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const device = await notificationService.registerDevice(userId, req.body);
    return apiResponse(res, 200, device, 'تم تسجيل الجهاز');
});

export const unregisterDevice = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    await notificationService.unregisterDevice((req.params.id as string), userId);
    return apiResponse(res, 200, null, 'تم إلغاء تسجيل الجهاز');
});

export const sendSystemNotification = asyncHandler(async (req: Request, res: Response) => {
    const { userIds, allUsers, type, title, body, link, iconUrl, imageUrl, metadata } = req.body;
    const senderId = (req as any).user.userId;
    const count = await notificationService.sendSystemNotification(
        { type, title, body, link, iconUrl, imageUrl, metadata },
        { allUsers, userIds, senderId }
    );
    return apiResponse(res, 200, { count }, 'تم إرسال الإشعار');
});

export const archiveNotification = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const notification = await notificationService.archiveNotification((req.params.id as string), userId);
    return apiResponse(res, 200, notification, 'تم أرشفة الإشعار');
});

export const dismissNotification = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const notification = await notificationService.dismissNotification((req.params.id as string), userId);
    return apiResponse(res, 200, notification, 'تم تجاهل الإشعار');
});