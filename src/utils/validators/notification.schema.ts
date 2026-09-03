import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        isRead: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
        isArchived: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
        isDismissed: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
        type: z.string().optional(),
    }),
});

export const markNotificationReadParamsSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const registerDeviceSchema = z.object({
    body: z.object({
        deviceToken: z.string().min(1, 'Device token required'),
        deviceType: z.enum(['ios', 'android', 'web']),
        deviceId: z.string().optional(),
        deviceModel: z.string().optional(),
        osVersion: z.string().optional(),
        appVersion: z.string().optional(),
    }),
});

export const unregisterDeviceParamsSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const adminSendNotificationSchema = z.object({
    body: z.object({
        userIds: z.array(z.string().uuid()).optional(),
        allUsers: z.boolean().optional().default(false),
        type: z.string().min(1),
        title: z.string().min(1),
        body: z.string().min(1),
        link: z.string().url().optional().nullable(),
        iconUrl: z.string().url().optional().nullable(),
        imageUrl: z.string().url().optional().nullable(),
        metadata: z.any().optional(),
    }).refine(data => data.allUsers || (data.userIds && data.userIds.length > 0), {
        message: 'Either allUsers must be true or userIds must contain at least one user',
        path: ['userIds'],
    }),
});