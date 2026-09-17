import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Slides — Integration', () => {
    let accessToken: string;
    let lessonId: string;

    beforeAll(async () => {
        const lesson = await prisma.lesson.findFirst({
            where: { isPublished: true, slides: { some: {} } },
            include: { module: { select: { pathId: true } } },
        });
        expect(lesson).toBeDefined();
        lessonId = lesson!.id;
        const pathId = lesson!.module.pathId;

        const email = `slides_${Date.now()}@example.com`;
        const reg = await request(app)
            .post('/v1/auth/register')
            .send({
                email,
                password: 'Slides@123456',
                fullName: 'Slides Tester',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        accessToken = reg.body.data.accessToken;

        await request(app)
            .post(`/v1/enrollments/paths/${pathId}/enroll`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(201);
    });

    it('GET /lessons/:lessonId/slides — anonymous returns slides without completed flag', async () => {
        const res = await request(app)
            .get(`/v1/lessons/${lessonId}/slides`)
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0]).not.toHaveProperty('completed');
    });

    it('GET /lessons/:lessonId/slides — authenticated returns completed flag', async () => {
        const res = await request(app)
            .get(`/v1/lessons/${lessonId}/slides`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.data[0]).toHaveProperty('completed');
        expect(typeof res.body.data[0].completed).toBe('boolean');
    });

    it('POST complete — INFO slide always passes with empty answer', async () => {
        const infoSlide = await prisma.slide.findFirst({
            where: { lessonId, slideType: 'INFO' },
        });
        expect(infoSlide).toBeDefined();

        const res = await request(app)
            .post(`/v1/lessons/${lessonId}/slides/${infoSlide!.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({})
            .expect(200);

        expect(res.body.data.completed).toBe(true);
        expect(res.body.data.isCorrect).toBe(true);
    });

    it('POST complete — duplicate submission returns 400', async () => {
        const infoSlide = await prisma.slide.findFirst({
            where: { lessonId, slideType: 'INFO' },
        });

        await request(app)
            .post(`/v1/lessons/${lessonId}/slides/${infoSlide!.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({})
            .expect(400);
    });

    it('POST complete — client-submitted isCorrect is rejected by .strict()', async () => {
        const quizSlide = await prisma.slide.findFirst({
            where: { lessonId, slideType: 'QUIZ' },
        });
        expect(quizSlide).toBeDefined();

        const res = await request(app)
            .post(`/v1/lessons/${lessonId}/slides/${quizSlide!.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ answer: { index: 0 }, isCorrect: true })
            .expect(400);

        expect(res.body.success).toBe(false);
    });

    it('POST complete — server evaluates QUIZ correctness (wrong answer)', async () => {
        const quizSlide = await prisma.slide.findFirst({
            where: { lessonId, slideType: 'QUIZ' },
        });

        const res = await request(app)
            .post(`/v1/lessons/${lessonId}/slides/${quizSlide!.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ answer: { index: 999 } }) // wrong
            .expect(200);

        expect(res.body.data.isCorrect).toBe(false);
        expect(res.body.data.xpEarned).toBe(0);
    });
});