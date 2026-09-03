import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { sendNotificationEmail } from './email.service';
import { logger } from '../config/logger';

interface NotificationData {
    type: string;
    title: string;
    body: string;
    link?: string | null;
    iconUrl?: string | null;
    imageUrl?: string | null;
    metadata?: Record<string, any>;
}

interface Pagination {
    page: number;
    limit: number;
}

interface NotificationFilters {
    isRead?: boolean;
    isArchived?: boolean;
    isDismissed?: boolean;
    type?: string;
}

interface CreateNotificationOptions {
    senderId?: string;
    channels?: string[];
}

export const createNotification = async (
        userId: string,
        data: NotificationData,
        options: CreateNotificationOptions = {}
    ): Promise<any> => {
    const { senderId, channels = ['in_app'] } = options;
    const notification = await prisma.notification.create({
        data: {
        userId,
        senderId,
        type: data.type,
        title: data.title,
        body: data.body,
        link: data.link,
        iconUrl: data.iconUrl,
        imageUrl: data.imageUrl,
        metadata: data.metadata || {},
        channelsSent: channels,
        },
    });

    if (channels.includes('email')) {
        await sendEmailForNotification(userId, { title: data.title, body: data.body, link: data.link });
    }
    if (channels.includes('push')) {
        await sendPushForNotification(userId, { title: data.title, body: data.body });
    }

    return notification;
};

export const createBulkNotification = async (
        userIds: string[],
        data: NotificationData,
        options: CreateNotificationOptions = {}
    ): Promise<number> => {
    const { senderId, channels = ['in_app'] } = options;
    const notifications = await prisma.notification.createMany({
        data: userIds.map(userId => ({
        userId,
        senderId,
        type: data.type,
        title: data.title,
        body: data.body,
        link: data.link,
        iconUrl: data.iconUrl,
        imageUrl: data.imageUrl,
        metadata: data.metadata || {},
        channelsSent: channels,
        })),
    });

    if (channels.includes('email')) {
        const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
        });
        for (const user of users) {
        try {
            if (user.email) {
            await sendNotificationEmail(user.email, {
                title: data.title,
                body: data.body,
                link: data.link ?? undefined, // Coerce null to undefined
            });
            }
        } catch (error) {
            logger.error({ error, userId: user.id }, 'Failed to send email notification');
        }
        }
    }
    if (channels.includes('push')) {
        logger.info(`[DEV] Push notifications would be sent to ${userIds.length} users`);
    }

    return notifications.count;
};

export const sendSystemNotification = async (
        data: NotificationData,
        options: { allUsers?: boolean; userIds?: string[]; senderId?: string }
    ): Promise<number> => {
    let recipientIds: string[] = [];
    if (options.allUsers) {
        const users = await prisma.user.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true },
        });
        recipientIds = users.map(u => u.id);
    } else if (options.userIds && options.userIds.length > 0) {
        recipientIds = options.userIds;
    } else {
        throw new AppError(400, 'يجب تحديد المستلمين');
    }

    return createBulkNotification(recipientIds, data, {
        senderId: options.senderId,
        channels: ['in_app', 'email'],
    });
};

export const sendEmailForNotification = async (
        userId: string,
        notificationData: { title: string; body: string; link?: string | null }
    ): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
        });
        if (user?.email) {
        await sendNotificationEmail(user.email, {
            title: notificationData.title,
            body: notificationData.body,
            link: notificationData.link ?? undefined, // Coerce null to undefined
        });
        }
    } catch (error) {
        logger.error({ error, userId }, 'Failed to send email notification');
    }
};

export const sendPushForNotification = async (
        userId: string,
        notificationData: { title: string; body: string }
    ): Promise<void> => {
    // TODO: Integrate Firebase Cloud Messaging
    logger.info(`[DEV] Push notification would be sent to user ${userId}: ${notificationData.title}`);
};

export const listNotifications = async (
        userId: string,
        filters: NotificationFilters,
        pagination: Pagination
    ) => {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (filters.isRead !== undefined) where.isRead = filters.isRead;
    if (filters.isArchived !== undefined) where.isArchived = filters.isArchived;
    if (filters.isDismissed !== undefined) where.isDismissed = filters.isDismissed;
    if (filters.type) where.type = filters.type;

    const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where }),
    ]);

    return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

export const getUnreadCount = async (userId: string): Promise<number> => {
    return prisma.notification.count({
        where: { userId, isRead: false },
    });
};

export const markAsRead = async (notificationId: string, userId: string) => {
    const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
    });
    if (!notification) throw new AppError(404, 'الإشعار غير موجود');

    return prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
    });
};

export const markAllAsRead = async (userId: string): Promise<number> => {
    const result = await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
    });
    return result.count;
};

export const archiveNotification = async (notificationId: string, userId: string) => {
    const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
    });
    if (!notification) throw new AppError(404, 'الإشعار غير موجود');

    return prisma.notification.update({
        where: { id: notificationId },
        data: { isArchived: true },
    });
};

export const dismissNotification = async (notificationId: string, userId: string) => {
    const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
    });
    if (!notification) throw new AppError(404, 'الإشعار غير موجود');

    return prisma.notification.update({
        where: { id: notificationId },
        data: { isDismissed: true, dismissedAt: new Date() },
    });
};

export const deleteNotification = async (notificationId: string, userId: string): Promise<void> => {
    const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
    });
    if (!notification) throw new AppError(404, 'الإشعار غير موجود');

    await prisma.notification.delete({
        where: { id: notificationId },
    });
};

export const registerDevice = async (
        userId: string,
        data: {
            deviceToken: string;
            deviceType: string;
            deviceId?: string;
            deviceModel?: string;
            osVersion?: string;
            appVersion?: string;
        }
    ) => {
    const existing = await prisma.deviceToken.findUnique({
        where: { userId_deviceToken: { userId, deviceToken: data.deviceToken } },
    });
    if (existing) {
        return prisma.deviceToken.update({
        where: { id: existing.id },
        data: {
            deviceType: data.deviceType,
            deviceId: data.deviceId,
            deviceModel: data.deviceModel,
            osVersion: data.osVersion,
            appVersion: data.appVersion,
            isActive: true,
            lastUsedAt: new Date(),
        },
        });
    }
    return prisma.deviceToken.create({
        data: {
        userId,
        deviceToken: data.deviceToken,
        deviceType: data.deviceType,
        deviceId: data.deviceId,
        deviceModel: data.deviceModel,
        osVersion: data.osVersion,
        appVersion: data.appVersion,
        },
    });
};

export const unregisterDevice = async (deviceTokenId: string, userId: string): Promise<void> => {
    const device = await prisma.deviceToken.findFirst({
        where: { id: deviceTokenId, userId },
    });
    if (!device) throw new AppError(404, 'الجهاز غير موجود');

    await prisma.deviceToken.delete({
        where: { id: deviceTokenId },
    });
};

export const listDevices = async (userId: string) => {
    return prisma.deviceToken.findMany({
        where: { userId, isActive: true },
    });
};