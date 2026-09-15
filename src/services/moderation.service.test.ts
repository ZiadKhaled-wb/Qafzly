import { prisma } from '../../src/config/database';
import { AppError } from '../../src/utils/AppError';
import * as moderationService from '../services/moderation.service';

jest.mock('../../config/database', () => ({
    prisma: {
        forumReport: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
        },
        forumPost: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        forumComment: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

describe('Moderation Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.$transaction as jest.Mock).mockImplementation(async (arg: any) => {
            if (typeof arg === 'function') return arg(prisma);
            return Promise.all(arg);
        });
    });

    describe('listReports', () => {
        it('should return paginated pending reports with embedded targets', async () => {
            const mockReports = [
                {
                    id: 'report-1',
                    postId: 'post-1',
                    reason: 'spam',
                    status: 'pending',
                    reporter: { id: 'u1', fullName: 'Reporter', email: 'r@x.com' },
                    post: { id: 'post-1', title: 'Bad post', flaggedCount: 3 },
                    comment: null,
                },
            ];
            (prisma.forumReport.findMany as jest.Mock).mockResolvedValue(mockReports);
            (prisma.forumReport.count as jest.Mock).mockResolvedValue(1);

            const result = await moderationService.listReports({
                page: 1,
                limit: 10,
                status: 'pending',
            });

            expect(prisma.forumReport.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { status: 'pending' },
                })
            );
            expect(result.reports).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('should default status to pending', async () => {
            (prisma.forumReport.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.forumReport.count as jest.Mock).mockResolvedValue(0);

            await moderationService.listReports({ page: 1, limit: 10 });

            expect(prisma.forumReport.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { status: 'pending' },
                })
            );
        });
    });

    describe('resolveReport', () => {
        it('should mark report as resolved and decrement flaggedCount', async () => {
            (prisma.forumReport.findUnique as jest.Mock).mockResolvedValue({
                id: 'report-1',
                postId: 'post-1',
                commentId: null,
                status: 'pending',
            });
            (prisma.forumReport.update as jest.Mock).mockResolvedValue({});
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

            const result = await moderationService.resolveReport('report-1', 'admin-1');

            expect(prisma.forumReport.update).toHaveBeenCalledWith({
                where: { id: 'report-1' },
                data: expect.objectContaining({
                    status: 'resolved',
                    resolvedAt: expect.any(Date),
                    resolvedByUserId: 'admin-1',
                }),
            });
            expect(prisma.forumPost.update).toHaveBeenCalledWith({
                where: { id: 'post-1' },
                data: { flaggedCount: { decrement: 1 } },
            });
            expect(result.success).toBe(true);
        });

        it('should not decrement flaggedCount for comment-only reports', async () => {
            (prisma.forumReport.findUnique as jest.Mock).mockResolvedValue({
                id: 'report-2',
                postId: null,
                commentId: 'comment-1',
                status: 'pending',
            });
            (prisma.forumReport.update as jest.Mock).mockResolvedValue({});

            await moderationService.resolveReport('report-2', 'admin-1');

            expect(prisma.forumPost.update).not.toHaveBeenCalled();
        });

        it('should throw 404 when report not found', async () => {
            (prisma.forumReport.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(moderationService.resolveReport('bad', 'admin-1')).rejects.toThrow(AppError);
        });

        it('should throw 409 when report is not pending', async () => {
            (prisma.forumReport.findUnique as jest.Mock).mockResolvedValue({
                id: 'report-1',
                status: 'resolved',
            });
            await expect(moderationService.resolveReport('report-1', 'admin-1')).rejects.toThrow(AppError);
        });
    });

    describe('hidePost / unhidePost', () => {
        it('should hide a post', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1' });
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

            const result = await moderationService.hidePost('post-1');

            expect(prisma.forumPost.update).toHaveBeenCalledWith({
                where: { id: 'post-1' },
                data: { status: 'hidden' },
            });
            expect(result.success).toBe(true);
        });

        it('should throw 404 for missing post', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(moderationService.hidePost('bad')).rejects.toThrow(AppError);
        });

        it('should unhide a post', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1' });
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

            await moderationService.unhidePost('post-1');

            expect(prisma.forumPost.update).toHaveBeenCalledWith({
                where: { id: 'post-1' },
                data: { status: 'published' },
            });
        });
    });

    describe('hideComment / unhideComment', () => {
        it('should hide a comment', async () => {
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'comment-1' });
            (prisma.forumComment.update as jest.Mock).mockResolvedValue({});

            const result = await moderationService.hideComment('comment-1');

            expect(prisma.forumComment.update).toHaveBeenCalledWith({
                where: { id: 'comment-1' },
                data: { status: 'hidden' },
            });
            expect(result.success).toBe(true);
        });

        it('should throw 404 for missing comment', async () => {
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(moderationService.hideComment('bad')).rejects.toThrow(AppError);
        });

        it('should unhide a comment', async () => {
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'comment-1' });
            (prisma.forumComment.update as jest.Mock).mockResolvedValue({});

            await moderationService.unhideComment('comment-1');

            expect(prisma.forumComment.update).toHaveBeenCalledWith({
                where: { id: 'comment-1' },
                data: { status: 'published' },
            });
        });
    });
});