import request from 'supertest';
import app from '../../app';

describe('Health Check', () => {
    it('GET /health should return 200 and status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('timestamp');
    });
});