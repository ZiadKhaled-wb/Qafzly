import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Payment Request Flow', () => {
    let userToken: string;
    let adminToken: string;
    let pathId: string;
    let paymentRequestId: string;

    beforeAll(async () => {
        // Get a seeded path (preferably one with price > 0, but any is fine)
        const path = await prisma.path.findFirst();
        expect(path).toBeDefined();
        pathId = path!.id;

        // Create a user
        const userEmail = `payuser_${Date.now()}@example.com`;
        const res = await request(app)
            .post('/v1/auth/register')
            .send({ email: userEmail, password: 'Pay@123456', fullName: 'Payment User', language: 'ar', skillLevel: 'BEGINNER' })
            .expect(201);
        userToken = res.body.data.accessToken;

        // Login admin (seeded)
        const loginRes = await request(app)
            .post('/v1/auth/login')
            .send({ email: 'admin@qafzly.com', password: 'Admin@123456' })
            .expect(200);
        adminToken = loginRes.body.data.accessToken;
    });

    it('POST /payments/requests should create a payment request', async () => {
        const res = await request(app)
            .post('/v1/payments/requests')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ pathId, paymentMethod: 'vodafone_cash' })
            .expect(201);

        expect(res.body.data).toHaveProperty('requestId');
        paymentRequestId = res.body.data.requestId; // <-- use requestId, not id
    });

    it('GET /payments/requests should list user requests', async () => {
        const res = await request(app)
            .get('/v1/payments/requests')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('POST /payments/admin/requests/:id/activate should activate the request (admin)', async () => {
        const res = await request(app)
            .post(`/v1/payments/admin/requests/${paymentRequestId}/activate`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ subscriptionDurationMonths: 1 })
            .expect(200);

        expect(res.body.success).toBe(true);
    });
});