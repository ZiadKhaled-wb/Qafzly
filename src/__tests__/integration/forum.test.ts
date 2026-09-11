import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Forum Operations', () => {
    let userToken: string;
    let forumCategoryId: string;
    let postId: string;

    beforeAll(async () => {
        // Get first forum category (seed creates some? Check seed - it does not create forum categories)
        // If none, create one manually
        let category = await prisma.forumCategory.findFirst();
        if (!category) {
            category = await prisma.forumCategory.create({
                data: {
                    nameAr: 'اختبار',
                    nameEn: 'Test',
                    slug: 'test-category',
                },
            });
        }
        forumCategoryId = category.id;

        // Register and login user
        const email = `forum_${Date.now()}@example.com`;
        const res = await request(app)
            .post('/v1/auth/register')
            .send({ email, password: 'Forum@123456', fullName: 'Forum User', language: 'ar', skillLevel: 'BEGINNER' })
            .expect(201);
        userToken = res.body.data.accessToken;
    });

    it('POST /forum/posts should create a new post', async () => {
        const res = await request(app)
            .post('/v1/forum/posts')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ title: 'Test Post', content: 'This is a test post', categoryId: forumCategoryId })
            .expect(201);

        expect(res.body.data).toHaveProperty('id');
        postId = res.body.data.id;
    });

    it('GET /forum/posts should list posts', async () => {
        const res = await request(app)
            .get('/v1/forum/posts')
            .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
        // Our post should be in the list
        expect(res.body.data.some((p: any) => p.id === postId)).toBe(true);
    });

    it('POST /forum/posts/:postId/comments should add a comment', async () => {
        const res = await request(app)
            .post(`/v1/forum/posts/${postId}/comments`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ content: 'Test comment' })
            .expect(201);

        expect(res.body.success).toBe(true);
    });
});