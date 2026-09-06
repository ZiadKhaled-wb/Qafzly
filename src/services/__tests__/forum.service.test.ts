import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as forumService from '../forum.service';

jest.mock('../../config/database', () => ({
    prisma: {
        forumCategory: {
        findMany: jest.fn(),
        count: jest.fn(),
        },
        forumPost: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        },
        forumComment: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        },
        forumVote: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        },
    },
}));

describe('Forum Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('listCategories', () => {
        it('should return categories without filters', async () => {
        const mockCategories = [{ id: 'cat-1', nameAr: 'عام', nameEn: 'General', slug: 'general' }];
        (prisma.forumCategory.findMany as jest.Mock).mockResolvedValue(mockCategories);
        (prisma.forumCategory.count as jest.Mock).mockResolvedValue(1);

        const result = await forumService.listCategories({ page: 1, limit: 10 });

        expect(prisma.forumCategory.findMany).toHaveBeenCalled();
        expect(result.categories).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.totalPages).toBe(1);
        });

        it('should apply search and isActive filters', async () => {
        (prisma.forumCategory.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.forumCategory.count as jest.Mock).mockResolvedValue(0);

        await forumService.listCategories({ page: 1, limit: 10, search: 'test', isActive: true });

        const whereArg = (prisma.forumCategory.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg.OR).toBeDefined();
        expect(whereArg.isActive).toBe(true);
        });
    });

    describe('createPost', () => {
        it('should create a post', async () => {
        const input = { title: 'Test', content: 'Content' };
        const mockPost = { id: 'post-1', ...input, userId: 'user-1' };
        (prisma.forumPost.create as jest.Mock).mockResolvedValue(mockPost);

        const result = await forumService.createPost('user-1', input);

        expect(prisma.forumPost.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
            userId: 'user-1',
            title: 'Test',
            content: 'Content',
            }),
        });
        expect(result).toEqual(mockPost);
        });
    });

    describe('getPostById', () => {
        const basePost = {
        id: 'post-1',
        userId: 'user-1',
        deletedAt: null,
        status: 'published',
        viewCount: 0,
        };

        it('should return post for public user', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(basePost);
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

        const result = await forumService.getPostById('post-1');

        expect(prisma.forumPost.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'post-1' } })
        );
        expect(result).toEqual(basePost);
        expect(prisma.forumPost.update).toHaveBeenCalled();
        });

        it('should throw 404 if post not found', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(forumService.getPostById('bad')).rejects.toThrow(AppError);
        });

        it('should throw 404 if deleted and not admin', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ ...basePost, deletedAt: new Date() });
        await expect(forumService.getPostById('post-1')).rejects.toThrow(AppError);
        });

        it('should allow admin to see deleted post', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ ...basePost, deletedAt: new Date() });
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
        const result = await forumService.getPostById('post-1', 'user-1', true);
        expect(result).toBeDefined();
        });

        it('should throw 404 if hidden and not owner/admin', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ ...basePost, status: 'hidden' });
        await expect(forumService.getPostById('post-1', 'other-user')).rejects.toThrow(AppError);
        });

        it('should allow owner to see hidden post', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ ...basePost, status: 'hidden' });
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
        const result = await forumService.getPostById('post-1', 'user-1');
        expect(result).toBeDefined();
        });
    });

    describe('listPosts', () => {
        it('should return paginated posts with filters', async () => {
        const mockPosts = [{ id: 'post-1', title: 'Test' }];
        (prisma.forumPost.findMany as jest.Mock).mockResolvedValue(mockPosts);
        (prisma.forumPost.count as jest.Mock).mockResolvedValue(1);

        const result = await forumService.listPosts({
            page: 1,
            limit: 10,
            categoryId: 'cat-1',
            pathId: 'path-1',
            lessonId: 'lesson-1',
            status: 'published',
            search: 'test',
            sortBy: 'upvotes',
            order: 'desc',
        });

        const whereArg = (prisma.forumPost.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg).toMatchObject({
            deletedAt: null,
            categoryId: 'cat-1',
            pathId: 'path-1',
            lessonId: 'lesson-1',
            status: 'published',
        });
        expect(whereArg.OR).toBeDefined();
        expect((prisma.forumPost.findMany as jest.Mock).mock.calls[0][0].orderBy).toEqual({ upvotes: 'desc' });
        expect(result.posts).toHaveLength(1);
        expect(result.total).toBe(1);
        });

        it('should default sort to createdAt desc', async () => {
        (prisma.forumPost.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.forumPost.count as jest.Mock).mockResolvedValue(0);
        await forumService.listPosts({ page: 1, limit: 10 });
        expect((prisma.forumPost.findMany as jest.Mock).mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
        });
    });

    describe('updatePost', () => {
        it('should update own post', async () => {
        const existing = { id: 'post-1', userId: 'user-1', deletedAt: null };
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(existing);
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({ ...existing, title: 'Updated' });

        const result = await forumService.updatePost('post-1', 'user-1', { title: 'Updated' }, false);

        expect(prisma.forumPost.update).toHaveBeenCalled();
        expect(result.title).toBe('Updated');
        });

        it('should throw 404 if not found or deleted', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(forumService.updatePost('bad', 'user-1', {})).rejects.toThrow(AppError);
        });

        it('should throw 403 if not owner and not admin', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1', userId: 'other', deletedAt: null });
        await expect(forumService.updatePost('post-1', 'user-1', {})).rejects.toThrow(AppError);
        });

        it('should allow admin to update any post', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1', userId: 'other', deletedAt: null });
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
        const result = await forumService.updatePost('post-1', 'admin', { title: 'Admin update' }, true);
        expect(result).toBeDefined();
        });
    });

    describe('deletePost', () => {
        it('should soft delete own post', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1', userId: 'user-1', deletedAt: null });
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
        await forumService.deletePost('post-1', 'user-1', false);
        expect(prisma.forumPost.update).toHaveBeenCalledWith({
            where: { id: 'post-1' },
            data: { deletedAt: expect.any(Date), status: 'deleted' },
        });
        });

        it('should throw 403 if not owner/admin', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1', userId: 'other', deletedAt: null });
        await expect(forumService.deletePost('post-1', 'user-1', false)).rejects.toThrow(AppError);
        });

        it('should allow admin to delete any post', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1', userId: 'other', deletedAt: null });
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
        await forumService.deletePost('post-1', 'admin', true);
        expect(prisma.forumPost.update).toHaveBeenCalled();
        });
    });

    describe('addComment', () => {
        it('should add comment and increment count', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1', deletedAt: null, isLocked: false });
        (prisma.forumComment.create as jest.Mock).mockResolvedValue({ id: 'comment-1', content: 'Nice' });
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

        const result = await forumService.addComment('post-1', 'user-1', { content: 'Nice' });

        expect(prisma.forumComment.create).toHaveBeenCalled();
        expect(prisma.forumPost.update).toHaveBeenCalledWith({
            where: { id: 'post-1' },
            data: { commentCount: { increment: 1 } },
        });
        expect(result).toEqual({ id: 'comment-1', content: 'Nice' });
        });

        it('should throw 404 if post not found', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(forumService.addComment('bad', 'user', { content: 'x' })).rejects.toThrow(AppError);
        });

        it('should throw 422 if post is locked', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'post-1', deletedAt: null, isLocked: true });
        await expect(forumService.addComment('post-1', 'user', { content: 'x' })).rejects.toThrow(AppError);
        });
    });

    describe('getComments', () => {
        it('should return comments for post', async () => {
        const mockComments = [{ id: 'c1', content: 'Hello' }];
        (prisma.forumComment.findMany as jest.Mock).mockResolvedValue(mockComments);
        (prisma.forumComment.count as jest.Mock).mockResolvedValue(1);

        const result = await forumService.getComments('post-1', { page: 1, limit: 10 });

        const whereArg = (prisma.forumComment.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg).toMatchObject({ postId: 'post-1', deletedAt: null, status: 'published' });
        expect(result.comments).toHaveLength(1);
        expect(result.total).toBe(1);
        });
    });

    describe('updateComment', () => {
        it('should update own comment', async () => {
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', userId: 'user-1', deletedAt: null });
        (prisma.forumComment.update as jest.Mock).mockResolvedValue({ id: 'c1', content: 'Updated', isEdited: true });

        const result = await forumService.updateComment('c1', 'user-1', { content: 'Updated' }, false);
        expect(result.content).toBe('Updated');
        expect(prisma.forumComment.update).toHaveBeenCalledWith({
            where: { id: 'c1' },
            data: { content: 'Updated', isEdited: true },
        });
        });

        it('should throw 403 if not owner', async () => {
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', userId: 'other', deletedAt: null });
        await expect(forumService.updateComment('c1', 'user-1', {}, false)).rejects.toThrow(AppError);
        });
    });

    describe('deleteComment', () => {
        it('should soft delete comment and decrement count', async () => {
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', userId: 'user-1', postId: 'p1', deletedAt: null });
        (prisma.forumComment.update as jest.Mock).mockResolvedValue({});
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

        await forumService.deleteComment('c1', 'user-1', false);

        expect(prisma.forumComment.update).toHaveBeenCalledWith({
            where: { id: 'c1' },
            data: { deletedAt: expect.any(Date), status: 'deleted' },
        });
        expect(prisma.forumPost.update).toHaveBeenCalledWith({
            where: { id: 'p1' },
            data: { commentCount: { decrement: 1 } },
        });
        });

        it('should throw 403 if not owner', async () => {
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', userId: 'other', deletedAt: null });
        await expect(forumService.deleteComment('c1', 'user-1', false)).rejects.toThrow(AppError);
        });
    });

    describe('vote', () => {
        it('should create new upvote on post', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', deletedAt: null });
        (prisma.forumVote.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.forumVote.create as jest.Mock).mockResolvedValue({});
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

        await forumService.vote('post', 'p1', 'user-1', 1);

        expect(prisma.forumVote.create).toHaveBeenCalled();
        expect(prisma.forumPost.update).toHaveBeenCalledWith({
            where: { id: 'p1' },
            data: { upvotes: { increment: 1 } },
        });
        });

        it('should remove existing upvote when same vote toggled', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', deletedAt: null });
        (prisma.forumVote.findUnique as jest.Mock).mockResolvedValue({ id: 'v1', voteType: 1 });
        (prisma.forumVote.delete as jest.Mock).mockResolvedValue({});
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

        await forumService.vote('post', 'p1', 'user-1', 1);

        expect(prisma.forumVote.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
        expect(prisma.forumPost.update).toHaveBeenCalledWith({
            where: { id: 'p1' },
            data: { upvotes: { increment: -1 } },
        });
        });

        it('should change existing vote from up to down', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', deletedAt: null });
        (prisma.forumVote.findUnique as jest.Mock).mockResolvedValue({ id: 'v1', voteType: 1 });
        (prisma.forumVote.update as jest.Mock).mockResolvedValue({});
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

        await forumService.vote('post', 'p1', 'user-1', -1);

        expect(prisma.forumVote.update).toHaveBeenCalledWith({
            where: { id: 'v1' },
            data: { voteType: -1 },
        });
        // We don't check exact update payload for brevity, but ensure it was called with something
        expect(prisma.forumPost.update).toHaveBeenCalled();
        });

        it('should throw 404 if target not found', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(forumService.vote('post', 'bad', 'user', 1)).rejects.toThrow(AppError);
        });
    });

    describe('markBestAnswer', () => {
        it('should mark answer and set post solved', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'user-1' });
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', postId: 'p1' });
        (prisma.forumComment.updateMany as jest.Mock).mockResolvedValue({});
        (prisma.forumComment.update as jest.Mock).mockResolvedValue({});
        (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'user-1', isSolved: true });

        const result = await forumService.markBestAnswer('p1', 'c1', 'user-1');

        expect(prisma.forumComment.updateMany).toHaveBeenCalled();
        expect(prisma.forumComment.update).toHaveBeenCalledWith({
            where: { id: 'c1' },
            data: { isBestAnswer: true },
        });
        expect(prisma.forumPost.update).toHaveBeenCalledWith({
            where: { id: 'p1' },
            data: { isSolved: true },
        });
        expect(result).not.toBeNull();
        expect(result!.isSolved).toBe(true);
        });

        it('should throw 403 if not post owner', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'other' });
        await expect(forumService.markBestAnswer('p1', 'c1', 'user-1')).rejects.toThrow(AppError);
        });

        it('should throw 404 if comment not in post', async () => {
        (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'user-1' });
        (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', postId: 'other' });
        await expect(forumService.markBestAnswer('p1', 'c1', 'user-1')).rejects.toThrow(AppError);
        });
    });

    describe('searchPosts', () => {
        it('should search posts', async () => {
        const mockPosts = [{ id: 'p1', title: 'Test' }];
        (prisma.forumPost.findMany as jest.Mock).mockResolvedValue(mockPosts);
        (prisma.forumPost.count as jest.Mock).mockResolvedValue(1);

        const result = await forumService.searchPosts('test', { page: 1, limit: 10 });

        const whereArg = (prisma.forumPost.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg.OR).toBeDefined();
        expect(result.posts).toHaveLength(1);
        expect(result.total).toBe(1);
        });
    });
});