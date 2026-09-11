import request from 'supertest';
import app from '../../app';

describe('Authentication Flow', () => {
    const testUser = {
        email: `test_${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Integration Test User',
        language: 'ar',
        skillLevel: 'BEGINNER',
    };

    let accessToken: string;
    let refreshToken: string;

    it('POST /auth/register should create a new user', async () => {
        const res = await request(app)
            .post('/v1/auth/register')
            .send(testUser)
            .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.user).toHaveProperty('id');
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();

        accessToken = res.body.data.accessToken;
        refreshToken = res.body.data.refreshToken;
    });

    it('POST /auth/login should work with the new user', async () => {
        const res = await request(app)
            .post('/v1/auth/login')
            .send({ email: testUser.email, password: testUser.password })
            .expect(200);

        expect(res.body.data.accessToken).toBeDefined();
        // Update tokens from login
        accessToken = res.body.data.accessToken;
        refreshToken = res.body.data.refreshToken;
    });

    it('POST /auth/refresh should issue a new access token', async () => {
        const res = await request(app)
            .post('/v1/auth/refresh')
            .send({ refreshToken })
            .expect(200);

        expect(res.body.data.accessToken).toBeDefined();
    });
});