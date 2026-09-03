import { prisma } from '../../config/database';
import * as notificationService from '../notification.service';
import { sendNotificationEmail } from '../email.service';
import { AppError } from '../../utils/AppError';
import { logger } from '../../config/logger';

jest.mock('../../config/database', () => ({
    prisma: {
        notification: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        },
        user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        },
        deviceToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        },
    },
}));

jest.mock('../email.service', () => ({
    sendNotificationEmail: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('Notification Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createNotification', () => {
        const mockNotification = {
        id: '1',
        userId: 'user1',
        type: 'test',
        title: 'Test',
        body: 'Body',
        link: null,
        iconUrl: null,
        imageUrl: null,
        metadata: {},
        isRead: false,
        isArchived: false,
        isDismissed: false,
        channelsSent: ['in_app'],
        createdAt: new Date(),
        readAt: null,
        dismissedAt: null,
        };

        it('should create notification with default in_app channel', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

        const result = await notificationService.createNotification('user1', {
            type: 'test', title: 'Test', body: 'Body',
        });

        expect(prisma.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
            userId: 'user1',
            type: 'test',
            title: 'Test',
            body: 'Body',
            channelsSent: ['in_app'],
            }),
        });
        expect(result).toEqual(mockNotification);
        expect(sendNotificationEmail).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalled();
        });

        it('should send email when email channel included', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com' });
        (sendNotificationEmail as jest.Mock).mockResolvedValue(undefined);

        await notificationService.createNotification('user1', {
            type: 'test', title: 'Test', body: 'Body', link: 'http://example.com',
        }, { channels: ['in_app', 'email'] });

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'user1' },
            select: { email: true },
        });
        expect(sendNotificationEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.objectContaining({ title: 'Test', body: 'Body', link: 'http://example.com' })
        );
        });

        it('should not send email if no email found', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: null });

        await notificationService.createNotification('user1', {
            type: 'test', title: 'Test', body: 'Body',
        }, { channels: ['email'] });

        expect(sendNotificationEmail).not.toHaveBeenCalled();
        });

        it('should catch and log email errors', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com' });
        (sendNotificationEmail as jest.Mock).mockRejectedValue(new Error('Email failed'));

        await expect(
            notificationService.createNotification('user1', { type: 'test', title: 'Test', body: 'Body' }, { channels: ['email'] })
        ).resolves.toEqual(mockNotification);

        expect(sendNotificationEmail).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalled();
        });

        it('should log push notification when push channel included', async () => {
        (prisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

        await notificationService.createNotification('user1', { type: 'test', title: 'Test', body: 'Body' }, { channels: ['push'] });

        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Push notification would be sent')
        );
        });
    });

    describe('createBulkNotification', () => {
        const userIds = ['user1', 'user2'];
        const data = { type: 'test', title: 'Test', body: 'Body' };

        it('should create many notifications and return count', async () => {
        (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });

        const count = await notificationService.createBulkNotification(userIds, data);
        expect(prisma.notification.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
            expect.objectContaining({ userId: 'user1' }),
            expect.objectContaining({ userId: 'user2' }),
            ]),
        });
        expect(count).toBe(2);
        expect(sendNotificationEmail).not.toHaveBeenCalled();
        expect(prisma.user.findMany).not.toHaveBeenCalled();
        });

        it('should send emails when email channel included', async () => {
        (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });
        (prisma.user.findMany as jest.Mock).mockResolvedValue([
            { id: 'user1', email: 'user1@example.com' },
            { id: 'user2', email: 'user2@example.com' },
        ]);
        (sendNotificationEmail as jest.Mock).mockResolvedValue(undefined);

        await notificationService.createBulkNotification(userIds, data, { channels: ['in_app', 'email'] });

        expect(prisma.user.findMany).toHaveBeenCalledWith({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
        });
        expect(sendNotificationEmail).toHaveBeenCalledTimes(2);
        });

        it('should catch email errors and log them', async () => {
        (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });
        (prisma.user.findMany as jest.Mock).mockResolvedValue([
            { id: 'user1', email: 'user1@example.com' },
            { id: 'user2', email: 'user2@example.com' },
        ]);
        (sendNotificationEmail as jest.Mock)
            .mockRejectedValueOnce(new Error('Fail1'))
            .mockRejectedValueOnce(new Error('Fail2'));

        await notificationService.createBulkNotification(userIds, data, { channels: ['email'] });

        expect(sendNotificationEmail).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledTimes(2);
        });

        it('should log push when push channel included', async () => {
        (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });

        await notificationService.createBulkNotification(userIds, data, { channels: ['push'] });
        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Push notifications would be sent')
        );
        });
    });

    describe('sendSystemNotification', () => {
        const data = { type: 'system', title: 'Hello', body: 'World' };

        it('should send to all active users when allUsers is true', async () => {
        (prisma.user.findMany as jest.Mock)
            .mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }])
            .mockResolvedValueOnce([]);

        (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });

        const count = await notificationService.sendSystemNotification(data, { allUsers: true, senderId: 'admin1' });
        expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
        expect(prisma.notification.createMany).toHaveBeenCalled();
        expect(count).toBe(2);
        });

        it('should send to specified userIds', async () => {
        (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

        const count = await notificationService.sendSystemNotification(data, { userIds: ['u1'], senderId: 'admin1' });

        expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.notification.createMany).toHaveBeenCalled();
        expect(count).toBe(1);
        });

        it('should throw 400 if no recipients', async () => {
        await expect(notificationService.sendSystemNotification(data, {})).rejects.toThrow(AppError);
        });
    });

    describe('listNotifications', () => {
        it('should return paginated notifications with filters', async () => {
        const mockNotifications = [{ id: '1' }, { id: '2' }];
        (prisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);
        (prisma.notification.count as jest.Mock).mockResolvedValue(2);

        const result = await notificationService.listNotifications(
            'user1',
            { isRead: false, type: 'test' },
            { page: 2, limit: 5 }
        );

        expect(prisma.notification.findMany).toHaveBeenCalledWith({
            where: { userId: 'user1', isRead: false, type: 'test' },
            skip: 5,
            take: 5,
            orderBy: { createdAt: 'desc' },
        });
        expect(result.totalPages).toBe(1);
        });

        it('should handle missing filters', async () => {
        (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.notification.count as jest.Mock).mockResolvedValue(0);

        const result = await notificationService.listNotifications('user1', {}, { page: 1, limit: 10 });
        expect(prisma.notification.findMany).toHaveBeenCalledWith({
            where: { userId: 'user1' },
            skip: 0,
            take: 10,
            orderBy: { createdAt: 'desc' },
        });
        expect(result.notifications).toEqual([]);
        });
    });

    describe('getUnreadCount', () => {
        it('should return count', async () => {
        (prisma.notification.count as jest.Mock).mockResolvedValue(3);
        const count = await notificationService.getUnreadCount('u1');
        expect(count).toBe(3);
        });
    });

    describe('markAsRead', () => {
        it('should mark as read and set readAt', async () => {
        const notif = { id: 'n1', userId: 'u1', isRead: false };
        (prisma.notification.findFirst as jest.Mock).mockResolvedValue(notif);
        (prisma.notification.update as jest.Mock).mockResolvedValue({ ...notif, isRead: true, readAt: new Date() });

        const result = await notificationService.markAsRead('n1', 'u1');
        expect(result.isRead).toBe(true);
        expect(prisma.notification.update).toHaveBeenCalledWith({
            where: { id: 'n1' },
            data: { isRead: true, readAt: expect.any(Date) },
        });
        });

        it('should throw 404 if not found', async () => {
        (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(notificationService.markAsRead('bad', 'u1')).rejects.toThrow(AppError);
        });
    });

    describe('markAllAsRead', () => {
        it('should mark all as read', async () => {
        (prisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
        const count = await notificationService.markAllAsRead('u1');
        expect(count).toBe(5);
        });
    });

    describe('archiveNotification', () => {
        it('should archive notification', async () => {
        (prisma.notification.findFirst as jest.Mock).mockResolvedValue({ id: 'n1' });
        (prisma.notification.update as jest.Mock).mockResolvedValue({ id: 'n1', isArchived: true });
        const result = await notificationService.archiveNotification('n1', 'u1');
        expect(result.isArchived).toBe(true);
        });

        it('should throw 404 if not found', async () => {
        (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(notificationService.archiveNotification('bad', 'u1')).rejects.toThrow(AppError);
        });
    });

    describe('dismissNotification', () => {
        it('should dismiss notification', async () => {
        (prisma.notification.findFirst as jest.Mock).mockResolvedValue({ id: 'n1' });
        (prisma.notification.update as jest.Mock).mockResolvedValue({ id: 'n1', isDismissed: true, dismissedAt: new Date() });
        const result = await notificationService.dismissNotification('n1', 'u1');
        expect(result.isDismissed).toBe(true);
        });

        it('should throw 404 if not found', async () => {
        (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(notificationService.dismissNotification('bad', 'u1')).rejects.toThrow(AppError);
        });
    });

    describe('deleteNotification', () => {
        it('should delete notification', async () => {
        (prisma.notification.findFirst as jest.Mock).mockResolvedValue({ id: 'n1' });
        await notificationService.deleteNotification('n1', 'u1');
        expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
        });

        it('should throw 404 if not found', async () => {
        (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(notificationService.deleteNotification('bad', 'u1')).rejects.toThrow(AppError);
        });
    });

    describe('registerDevice', () => {
        const deviceData = {
        deviceToken: 'tok123',
        deviceType: 'ios',
        deviceId: 'dev-id',
        deviceModel: 'iPhone 12',
        osVersion: '15.0',
        appVersion: '1.0.0',
        };

        it('should create new device', async () => {
        (prisma.deviceToken.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.deviceToken.create as jest.Mock).mockResolvedValue({ id: 'd1', ...deviceData });
        const result = await notificationService.registerDevice('u1', deviceData);
        expect(prisma.deviceToken.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ userId: 'u1', deviceToken: 'tok123' }),
        });
        expect(result.deviceToken).toBe('tok123');
        });

        it('should update existing device', async () => {
        const existing = { id: 'd1', userId: 'u1', deviceToken: 'tok123', deviceType: 'android' };
        (prisma.deviceToken.findUnique as jest.Mock).mockResolvedValue(existing);
        (prisma.deviceToken.update as jest.Mock).mockResolvedValue({ ...existing, deviceType: 'ios', isActive: true });
        const result = await notificationService.registerDevice('u1', deviceData);
        expect(prisma.deviceToken.update).toHaveBeenCalledWith({
            where: { id: 'd1' },
            data: expect.objectContaining({ deviceType: 'ios', isActive: true }),
        });
        expect(result.deviceType).toBe('ios');
        });
    });

    describe('unregisterDevice', () => {
        it('should delete device', async () => {
        (prisma.deviceToken.findFirst as jest.Mock).mockResolvedValue({ id: 'd1' });
        await notificationService.unregisterDevice('d1', 'u1');
        expect(prisma.deviceToken.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
        });

        it('should throw 404 if not found', async () => {
        (prisma.deviceToken.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(notificationService.unregisterDevice('bad', 'u1')).rejects.toThrow(AppError);
        });
    });

    describe('listDevices', () => {
        it('should return active devices', async () => {
        const devices = [{ id: 'd1', isActive: true }, { id: 'd2', isActive: true }];
        (prisma.deviceToken.findMany as jest.Mock).mockResolvedValue(devices);
        const result = await notificationService.listDevices('u1');
        expect(result).toEqual(devices);
        expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({ where: { userId: 'u1', isActive: true } });
        });
    });
});