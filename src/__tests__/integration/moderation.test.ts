import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Moderation — Integration', () => {
    let adminToken: string;
    let reporterToken: string;
    let postId: string;

    beforeAll(async () => {
        const ts = Date.now();

        const authorReg = await request(app)
            .post('/v1/auth/register')
            .send({
                email: `mod_author_${ts}@example.com`,
                password: 'Mod@123456',
                fullName: 'Post Author',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        const authorToken = authorReg.body.data.accessToken;

        const reporterReg = await request(app)
            .post('/v1/auth/register')
            .send({
                email: `mod_reporter_${ts}@example.com`,
                password: 'Mod@123456',
                fullName: 'Reporter',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        reporterToken = reporterReg.body.data.accessToken;

        const adminLogin = await request(app)
            .post('/v1/auth/login')
            .send({ email: 'admin@qafzly.com', password: 'Admin@123456' })
            .expect(200);
        adminToken = adminLogin.body.data.accessToken;

        // Author creates a post
        const postRes = await request(app)
            .post('/v1/forum/posts')
            .set('Authorization', `Bearer ${authorToken}`)
            .send({ title: 'Test post for moderation', content: 'This post will be flagged.' })
            .expect(201);
        postId = postRes.body.data.id;
    });

    it('POST /forum/posts/:id/report — reporter files a report', async () => {
        const res = await request(app)
            .post(`/v1/forum/posts/${postId}/report`)
            .set('Authorization', `Bearer ${reporterToken}`)
            .send({ reason: 'spam', details: 'Integration test report' })
            .expect(201);

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.reason).toBe('spam');
    });

    it('POST /forum/posts/:id/report — duplicate report → 409', async () => {
        await request(app)
            .post(`/v1/forum/posts/${postId}/report`)
            .set('Authorization', `Bearer ${reporterToken}`)
            .send({ reason: 'spam' })
            .expect(409);
    });

    it('GET /moderation/reports — admin sees the report', async () => {
        const res = await request(app)
            .get('/v1/moderation/reports')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(res.body.data.length).toBeGreaterThan(0);
        const matching = res.body.data.find((r: any) => r.postId === postId);
        expect(matching).toBeDefined();
        expect(matching.post).toBeDefined();
        expect(matching.reporter).toBeDefined();
        expect(matching.reason).toBe('spam');
    });

    let reportId: string;

    it('POST /moderation/reports/:id/resolve — resolves', async () => {
        const listRes = await request(app)
            .get('/v1/moderation/reports')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
        const matching = listRes.body.data.find((r: any) => r.postId === postId);
        reportId = matching.id;

        await request(app)
            .post(`/v1/moderation/reports/${reportId}/resolve`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
    });

    it('POST /moderation/reports/:id/resolve — duplicate resolve → 409', async () => {
        await request(app)
            .post(`/v1/moderation/reports/${reportId}/resolve`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(409);
    });

    it('POST /moderation/posts/:id/hide — hides post', async () => {
        await request(app)
            .post(`/v1/moderation/posts/${postId}/hide`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        const post = await prisma.forumPost.findUnique({ where: { id: postId } });
        expect(post?.status).toBe('hidden');
    });

    it('POST /moderation/posts/:id/unhide — unhides post', async () => {
        await request(app)
            .post(`/v1/moderation/posts/${postId}/unhide`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        const post = await prisma.forumPost.findUnique({ where: { id: postId } });
        expect(post?.status).toBe('published');
    });
});