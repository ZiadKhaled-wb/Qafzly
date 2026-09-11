import request from 'supertest';
import app from '../../app';

describe('User Profile Endpoints', () => {
    let accessToken: string;

    beforeAll(async () => {
        const email = `profile_${Date.now()}@example.com`;
        const password = 'Profile@123456';
        const fullName = 'Profile Test User';

        const regRes = await request(app)
            .post('/v1/auth/register')
            .send({ email, password, fullName, language: 'ar', skillLevel: 'BEGINNER' })
            .expect(201);

        accessToken = regRes.body.data.accessToken;
    });

    it('GET /users/me should return the current user', async () => {
        const res = await request(app)
            .get('/v1/users/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.data.user).toHaveProperty('id');
        expect(res.body.data.user).toHaveProperty('email');
    });

    it('PATCH /users/me should update the user profile', async () => {
        const res = await request(app)
            .patch('/v1/users/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ bio: 'This is a test bio' })
            .expect(200);

        expect(res.body.data.user.bio).toBe('This is a test bio');
    });
});