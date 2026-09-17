import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Notifications — Integration', () => {
    let userToken: string;
    let adminToken: string;
    let userId: string;

    beforeAll(async () => {
        const email = `notif_${Date.now()}@example.com`;
        const reg = await request(app)
            .post('/v1/auth/register')
            .send({
                email,
                password: 'Notif@123456',
                fullName: 'Notification Tester',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        userToken = reg.body.data.accessToken;
        userId = reg.body.data.user.id;

        const adminLogin = await request(app)
            .post('/v1/auth/login')
            .send({ email: 'admin@qafzly.com', password: 'Admin@123456' })
            .expect(200);
        adminToken = adminLogin.body.data.accessToken;
    });

    it('GET /notifications — initially empty', async () => {
        const res = await request(app)
            .get('/v1/notifications')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(0);
    });

    it('GET /notifications/unread/count — returns 0 for fresh user', async () => {
        const res = await request(app)
            .get('/v1/notifications/unread/count')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.data.count).toBe(0);
    });

    it('POST /admin/notifications — admin sends to specific user', async () => {
        const res = await request(app)
            .post('/v1/admin/notifications')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                userIds: [userId],
                type: 'system',
                title: 'Welcome to Qafzly',
                body: 'Your account is ready.',
            })
            .expect(200);

        expect(res.body.data.count).toBe(1);
    });

    let notificationId: string;

    it('GET /notifications — user sees the notification', async () => {
        const res = await request(app)
            .get('/v1/notifications')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].title).toBe('Welcome to Qafzly');
        notificationId = res.body.data[0].id;
    });

    it('GET /notifications/unread/count — now returns 1', async () => {
        const res = await request(app)
            .get('/v1/notifications/unread/count')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.data.count).toBe(1);
    });

    it('POST /notifications/:id/read — marks as read', async () => {
        await request(app)
            .post(`/v1/notifications/${notificationId}/read`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        const countRes = await request(app)
            .get('/v1/notifications/unread/count')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);
        expect(countRes.body.data.count).toBe(0);
    });

    it('POST /notifications/:id/archive — archives', async () => {
        await request(app)
            .post(`/v1/notifications/${notificationId}/archive`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        const res = await request(app)
            .get('/v1/notifications?isArchived=true')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);
        expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('POST /notifications/device/register — registers device', async () => {
        await request(app)
            .post('/v1/notifications/device/register')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                deviceToken: `fcm_${Date.now()}`,
                deviceType: 'web',
            })
            .expect(200);
    });

    it('DELETE /notifications/:id — deletes', async () => {
        await request(app)
            .delete(`/v1/notifications/${notificationId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);
    });
});