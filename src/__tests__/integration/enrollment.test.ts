import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Enrollment Flow', () => {
    let accessToken: string;
    let pathId: string;

    beforeAll(async () => {
        // Get a seeded published path
        const path = await prisma.path.findFirst({ where: { isPublished: true } });
        expect(path).toBeDefined();
        pathId = path!.id;

        // Register and login a user
        const email = `enroll_${Date.now()}@example.com`;
        const password = 'Enroll@123456';
        const fullName = 'Enrollment Test User';

        const regRes = await request(app)
            .post('/v1/auth/register')
            .send({ email, password, fullName, language: 'ar', skillLevel: 'BEGINNER' })
            .expect(201);
        accessToken = regRes.body.data.accessToken;
    });

    it('POST /enrollments/paths/:pathId/enroll should enroll user', async () => {
        const res = await request(app)
            .post(`/v1/enrollments/paths/${pathId}/enroll`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(201);

        expect(res.body.success).toBe(true);
    });

    it('GET /enrollments/me/enrollments should list at least one enrollment', async () => {
        const res = await request(app)
            .get('/v1/enrollments/me/enrollments')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
    });
});