import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as moderationService from '../moderation.service';

jest.mock('../../config/database', () => ({
    prisma: {
        forumPost: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        },
        forumComment: {
        findUnique: jest.fn(),
        update: jest.fn(),
        },
    },
}));

describe('Moderation Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('listReports', () => {
        it('should return paginated posts with flaggedCount > 0', async () => {
        const mockPosts = [
            { id: 'post-1', title: 'Test', content: 'Content', status: 'published', flaggedCount: 2 },
        ];
        (prisma.forumPost.findMany as jest.Mock).mockResolvedValue(mockPosts);
        (prisma.forumPost.count as jest.Mock).mockResolvedValue(1);

        const result = await moderationService.listReports({ page: 1, limit: 10 });

        expect(prisma.forumPost.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
            where: { flaggedCount: { gt: 0 } },
            skip: 0,
            take: 10,
            })
        );
        expect(result.reports).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.totalPages).toBe(1);
        });

        it('should apply status filter', async () => {
        (prisma.forumPost.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.forumPost.count as jest.Mock).mockResolvedValue(0);

        await moderationService.listReports({ page: 1, limit: 10, status: 'published' });

        const whereArg = (prisma.forumPost.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg).toEqual({ flaggedCount: { gt: 0 }, status: 'published' });
        });
    });

    describe('resolveReport', () => {
        it('should set flaggedCount to 0', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1' });
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

        const result = await moderationService.resolveReport('post-1', 'admin-1');

        expect(prisma.forumPost.update).toHaveBeenCalledWith({
            where: { id: 'post-1' },
            data: { flaggedCount: 0 },
        });
        expect(result).toEqual({ success: true });
        });

        it('should throw 404 if post not found', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(moderationService.resolveReport('bad', 'admin')).rejects.toThrow(AppError);
        });
    });

    describe('hidePost', () => {
        it('should set status to hidden', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1' });
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

        const result = await moderationService.hidePost('post-1');

        expect(prisma.forumPost.update).toHaveBeenCalledWith({
            where: { id: 'post-1' },
            data: { status: 'hidden' },
        });
        expect(result).toEqual({ success: true });
        });

        it('should throw 404 if post not found', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(moderationService.hidePost('bad')).rejects.toThrow(AppError);
        });
    });

    describe('unhidePost', () => {
        it('should set status to published', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1' });
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

        const result = await moderationService.unhidePost('post-1');

        expect(prisma.forumPost.update).toHaveBeenCalledWith({
            where: { id: 'post-1' },
            data: { status: 'published' },
        });
        expect(result).toEqual({ success: true });
        });

        it('should throw 404 if post not found', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(moderationService.unhidePost('bad')).rejects.toThrow(AppError);
        });
    });

    describe('hideComment', () => {
        it('should set status to hidden', async () => {
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'comment-1' });
        (prisma.forumComment.update as jest.Mock).mockResolvedValue({});

        const result = await moderationService.hideComment('comment-1');

        expect(prisma.forumComment.update).toHaveBeenCalledWith({
            where: { id: 'comment-1' },
            data: { status: 'hidden' },
        });
        expect(result).toEqual({ success: true });
        });

        it('should throw 404 if comment not found', async () => {
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(moderationService.hideComment('bad')).rejects.toThrow(AppError);
        });
    });

    describe('unhideComment', () => {
        it('should set status to published', async () => {
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'comment-1' });
        (prisma.forumComment.update as jest.Mock).mockResolvedValue({});

        const result = await moderationService.unhideComment('comment-1');

        expect(prisma.forumComment.update).toHaveBeenCalledWith({
            where: { id: 'comment-1' },
            data: { status: 'published' },
        });
        expect(result).toEqual({ success: true });
        });

        it('should throw 404 if comment not found', async () => {
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(moderationService.unhideComment('bad')).rejects.toThrow(AppError);
        });
    });
});