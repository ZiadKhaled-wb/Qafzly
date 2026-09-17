import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Forum Reporting — Integration', () => {
    let authorToken: string;
    let reporterToken: string;
    let postId: string;

    beforeAll(async () => {
        const ts = Date.now();

        const authorReg = await request(app)
            .post('/v1/auth/register')
            .send({
                email: `fr_author_${ts}@example.com`,
                password: 'ForumReport@123456',
                fullName: 'Forum Author',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        authorToken = authorReg.body.data.accessToken;

        const reporterReg = await request(app)
            .post('/v1/auth/register')
            .send({
                email: `fr_reporter_${ts}@example.com`,
                password: 'ForumReport@123456',
                fullName: 'Forum Reporter',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        reporterToken = reporterReg.body.data.accessToken;

        const postRes = await request(app)
            .post('/v1/forum/posts')
            .set('Authorization', `Bearer ${authorToken}`)
            .send({ title: 'Post to be reported', content: 'Content to test reporting.' })
            .expect(201);
        postId = postRes.body.data.id;
    });

    it('POST /forum/posts/:id/report — reporter files a report', async () => {
        const res = await request(app)
            .post(`/v1/forum/posts/${postId}/report`)
            .set('Authorization', `Bearer ${reporterToken}`)
            .send({ reason: 'harassment', details: 'Testing report flow' })
            .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.reason).toBe('harassment');
        expect(res.body.data.postId).toBe(postId);
    });

    it('POST /forum/posts/:id/report — duplicate by same reporter → 409', async () => {
        await request(app)
            .post(`/v1/forum/posts/${postId}/report`)
            .set('Authorization', `Bearer ${reporterToken}`)
            .send({ reason: 'spam' })
            .expect(409);
    });

    it('POST /forum/posts/:id/report — author reporting own post → 400', async () => {
        await request(app)
            .post(`/v1/forum/posts/${postId}/report`)
            .set('Authorization', `Bearer ${authorToken}`)
            .send({ reason: 'spam' })
            .expect(400);
    });

    it('POST /forum/posts/:id/report — invalid reason → 400', async () => {
        const otherUser = await request(app)
            .post('/v1/auth/register')
            .send({
                email: `fr_other_${Date.now()}@example.com`,
                password: 'ForumReport@123456',
                fullName: 'Other Reporter',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        const otherToken = otherUser.body.data.accessToken;

        await request(app)
            .post(`/v1/forum/posts/${postId}/report`)
            .set('Authorization', `Bearer ${otherToken}`)
            .send({ reason: 'not-a-valid-reason' })
            .expect(400);
    });

    it('flaggedCount on the post was incremented', async () => {
        const post = await prisma.forumPost.findUnique({
            where: { id: postId },
            select: { flaggedCount: true },
        });
        expect(post!.flaggedCount).toBeGreaterThan(0);
    });
});