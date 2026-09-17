import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Certificates — Integration', () => {
    let accessToken: string;
    let adminToken: string;
    let pathId: string;
    let certificateId: string;
    let certificateCode: string;

    beforeAll(async () => {
        const path = await prisma.path.findFirst({
            where: { isPublished: true, deletedAt: null },
            select: { id: true },
        });
        expect(path).toBeDefined();
        pathId = path!.id;

        const email = `cert_${Date.now()}@example.com`;
        const reg = await request(app)
            .post('/v1/auth/register')
            .send({
                email,
                password: 'Cert@123456',
                fullName: 'Certificate Tester',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        accessToken = reg.body.data.accessToken;

        const adminLogin = await request(app)
            .post('/v1/auth/login')
            .send({ email: 'admin@qafzly.com', password: 'Admin@123456' })
            .expect(200);
        adminToken = adminLogin.body.data.accessToken;

        await request(app)
            .post(`/v1/enrollments/paths/${pathId}/enroll`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(201);
    });

    it('Complete all published lessons in the path to trigger auto-issue', async () => {
        const lessons = await prisma.lesson.findMany({
            where: {
                isPublished: true,
                module: { pathId, isPublished: true },
            },
            select: { id: true },
        });
        expect(lessons.length).toBeGreaterThan(0);

        for (const lesson of lessons) {
            await request(app)
                .post(`/v1/progress/lessons/${lesson.id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ completed: true, timeSpent: 120 })
                .expect(200);
        }
    });

    it('GET /certificates/me — certificate was auto-issued', async () => {
        const res = await request(app)
            .get('/v1/certificates/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.data.length).toBeGreaterThan(0);
        const cert = res.body.data[0];
        expect(cert.certificateCode).toMatch(/^QFLZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
        certificateId = cert.id;
        certificateCode = cert.certificateCode;
    });

    it('GET /certificates/verify/:code — public verify returns valid: true', async () => {
        const res = await request(app)
            .get(`/v1/certificates/verify/${certificateCode}`)
            .expect(200);

        expect(res.body.data.valid).toBe(true);
        expect(res.body.data.certificate.certificateCode).toBe(certificateCode);
    });

    it('GET /certificates/verify/:code — unknown code returns valid: false', async () => {
        const res = await request(app)
            .get('/v1/certificates/verify/QFLZ-XXXX-YYYY')
            .expect(200);

        expect(res.body.data.valid).toBe(false);
        expect(res.body.data.reason).toBe('NOT_FOUND');
    });

    it('POST /certificates/admin/:id/revoke — admin revokes', async () => {
        const res = await request(app)
            .post(`/v1/certificates/admin/${certificateId}/revoke`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ reason: 'Integration test revocation' })
            .expect(200);

        expect(res.body.data.revokedAt).toBeTruthy();
    });

    it('GET /certificates/verify/:code — revoked cert returns valid: false + reason', async () => {
        const res = await request(app)
            .get(`/v1/certificates/verify/${certificateCode}`)
            .expect(200);

        expect(res.body.data.valid).toBe(false);
        expect(res.body.data.reason).toBe('REVOKED');
    });
});