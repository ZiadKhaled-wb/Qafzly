import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as forumService from '../forum.service';

jest.mock('../../config/database', () => ({
    prisma: {
        forumCategory: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
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
            findMany: jest.fn(),   // ← NEW: required by getUserVoteMap
            create: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
        },
        forumReport: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

// Helper — build a user shape that matches the service's select clause
const mockAuthor = {
    id: 'user-1',
    fullName: 'Test User',
    displayName: 'Tester',
    avatarUrl: null,
};

describe('Forum Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // $transaction mock: invokes callback OR resolves array
        (prisma.$transaction as jest.Mock).mockImplementation(async (arg: any) => {
            if (typeof arg === 'function') return arg(prisma);
            return Promise.all(arg);
        });
        // Default: no votes for the current user
        (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([]);
    });

    // =========================================================================
    // listCategories
    // =========================================================================
    describe('listCategories', () => {
        it('should return categories with postCount', async () => {
            const mockCategories = [
                {
                    id: 'cat-1',
                    nameAr: 'عام',
                    nameEn: 'General',
                    slug: 'general',
                    _count: { posts: 3 },
                },
            ];
            (prisma.forumCategory.findMany as jest.Mock).mockResolvedValue(mockCategories);
            (prisma.forumCategory.count as jest.Mock).mockResolvedValue(1);

            const result = await forumService.listCategories({ page: 1, limit: 10 });

            expect(prisma.forumCategory.findMany).toHaveBeenCalled();
            expect(result.categories).toHaveLength(1);
            expect(result.categories[0]).toEqual(
                expect.objectContaining({ id: 'cat-1', postCount: 3 })
            );
            expect(result.total).toBe(1);
            expect(result.totalPages).toBe(1);
        });

        it('should default to active-only categories', async () => {
            (prisma.forumCategory.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.forumCategory.count as jest.Mock).mockResolvedValue(0);

            await forumService.listCategories({ page: 1, limit: 10 });

            const whereArg = (prisma.forumCategory.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg.isActive).toBe(true);
        });

        it('should apply search and isActive filters', async () => {
            (prisma.forumCategory.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.forumCategory.count as jest.Mock).mockResolvedValue(0);

            await forumService.listCategories({
                page: 1,
                limit: 10,
                search: 'test',
                isActive: true,
            });

            const whereArg = (prisma.forumCategory.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg.OR).toBeDefined();
            expect(whereArg.isActive).toBe(true);
        });

        it('should allow fetching inactive categories when isActive=false', async () => {
            (prisma.forumCategory.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.forumCategory.count as jest.Mock).mockResolvedValue(0);

            await forumService.listCategories({ page: 1, limit: 10, isActive: false });

            const whereArg = (prisma.forumCategory.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg.isActive).toBe(false);
        });
    });

    // =========================================================================
    // createPost
    // =========================================================================
    describe('createPost', () => {
        it('should create a post and return it with author + category', async () => {
            const input = { title: 'Test', content: 'Content' };
            const created = { id: 'post-1', ...input, userId: 'user-1' };
            const withRelations = {
                ...created,
                user: mockAuthor,
                category: { id: 'cat-1', nameAr: 'عام', nameEn: 'General', slug: 'general' },
            };

            (prisma.forumPost.create as jest.Mock).mockResolvedValue(created);
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(withRelations);

            const result = await forumService.createPost('user-1', input);

            expect(prisma.forumPost.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-1',
                    title: 'Test',
                    content: 'Content',
                }),
            });
            expect(prisma.forumPost.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'post-1' } })
            );
            // New response shape: user → author, added userVote
            expect(result).toEqual(
                expect.objectContaining({
                    id: 'post-1',
                    author: mockAuthor,
                    userVote: null,
                })
            );
            // Must NOT contain the raw `user` field
            expect((result as any).user).toBeUndefined();
        });
    });

    // =========================================================================
    // getPostById
    // =========================================================================
    describe('getPostById', () => {
        const basePost = {
            id: 'post-1',
            userId: 'user-1',
            deletedAt: null,
            status: 'published',
            viewCount: 0,
            user: mockAuthor,
        };

        it('should return post for public user with author + null userVote', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(basePost);
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([]);

            const result = await forumService.getPostById('post-1');

            expect(prisma.forumPost.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'post-1' } })
            );
            expect(result).toEqual(
                expect.objectContaining({
                    id: 'post-1',
                    author: mockAuthor,
                    userVote: null,
                })
            );
            expect((result as any).user).toBeUndefined();
            expect(prisma.forumPost.update).toHaveBeenCalled();
        });

        it('should inject userVote="up" when the current user upvoted', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(basePost);
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([
                { targetId: 'post-1', voteType: 1 },
            ]);

            const result = await forumService.getPostById('post-1', 'user-1');

            expect(result.userVote).toBe('up');
            expect(prisma.forumVote.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: 'user-1',
                        targetType: 'post',
                        targetId: { in: ['post-1'] },
                    }),
                })
            );
        });

        it('should inject userVote="down" when the current user downvoted', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(basePost);
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([
                { targetId: 'post-1', voteType: -1 },
            ]);

            const result = await forumService.getPostById('post-1', 'user-1');
            expect(result.userVote).toBe('down');
        });

        it('should throw 404 if post not found', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(forumService.getPostById('bad')).rejects.toThrow(AppError);
        });

        it('should throw 404 if deleted and not admin', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                ...basePost,
                deletedAt: new Date(),
            });
            await expect(forumService.getPostById('post-1')).rejects.toThrow(AppError);
        });

        it('should allow admin to see deleted post', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                ...basePost,
                deletedAt: new Date(),
            });
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([]);

            const result = await forumService.getPostById('post-1', 'admin-1', true);
            expect(result).toBeDefined();
        });

        it('should throw 404 if hidden and not owner/admin', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                ...basePost,
                status: 'hidden',
            });
            await expect(forumService.getPostById('post-1', 'other-user')).rejects.toThrow(AppError);
        });

        it('should allow owner to see hidden post', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                ...basePost,
                status: 'hidden',
            });
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([]);

            const result = await forumService.getPostById('post-1', 'user-1');
            expect(result).toBeDefined();
        });
    });

    // =========================================================================
    // listPosts
    // =========================================================================
    describe('listPosts', () => {
        it('should return paginated posts with filters and array orderBy', async () => {
            const mockPosts = [
                {
                    id: 'post-1',
                    title: 'Test',
                    user: mockAuthor,
                    category: { id: 'cat-1', nameAr: 'عام', nameEn: 'General', slug: 'general' },
                },
            ];
            (prisma.forumPost.findMany as jest.Mock).mockResolvedValue(mockPosts);
            (prisma.forumPost.count as jest.Mock).mockResolvedValue(1);
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([]);

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
            // Service now uses an array for deterministic tie-breaking
            expect((prisma.forumPost.findMany as jest.Mock).mock.calls[0][0].orderBy).toEqual([
                { upvotes: 'desc' },
                { createdAt: 'desc' },
            ]);
            expect(result.posts).toHaveLength(1);
            expect(result.posts[0].author).toEqual(mockAuthor);
            expect(result.posts[0].userVote).toBeNull();
            expect(result.total).toBe(1);
        });

        it('should default sort to createdAt desc with tie-breaker', async () => {
            (prisma.forumPost.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.forumPost.count as jest.Mock).mockResolvedValue(0);
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([]);

            await forumService.listPosts({ page: 1, limit: 10 });

            expect((prisma.forumPost.findMany as jest.Mock).mock.calls[0][0].orderBy).toEqual([
                { createdAt: 'desc' },
                { createdAt: 'desc' },
            ]);
        });

        it('should inject per-post userVote for authenticated callers', async () => {
            (prisma.forumPost.findMany as jest.Mock).mockResolvedValue([
                { id: 'p1', user: mockAuthor },
                { id: 'p2', user: mockAuthor },
            ]);
            (prisma.forumPost.count as jest.Mock).mockResolvedValue(2);
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([
                { targetId: 'p1', voteType: 1 },
            ]);

            const result = await forumService.listPosts({ page: 1, limit: 10 }, 'user-1');

            expect(result.posts[0].userVote).toBe('up');
            expect(result.posts[1].userVote).toBeNull();
        });
    });

    // =========================================================================
    // updatePost
    // =========================================================================
    describe('updatePost', () => {
        it('should update own post and return shaped response', async () => {
            const existing = { id: 'post-1', userId: 'user-1', deletedAt: null };
            const updated = {
                ...existing,
                title: 'Updated',
                user: mockAuthor,
                category: { id: 'cat-1', nameAr: 'عام', nameEn: 'General', slug: 'general' },
            };
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(existing);
            (prisma.forumPost.update as jest.Mock).mockResolvedValue(updated);

            const result = await forumService.updatePost(
                'post-1',
                'user-1',
                { title: 'Updated' },
                false
            );

            expect(prisma.forumPost.update).toHaveBeenCalled();
            expect((result as any).title).toBe('Updated');
            expect((result as any).author).toEqual(mockAuthor);
            expect((result as any).user).toBeUndefined();
        });

        it('should throw 404 if not found or deleted', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(forumService.updatePost('bad', 'user-1', {})).rejects.toThrow(AppError);
        });

        it('should throw 403 if not owner and not admin', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                userId: 'other',
                deletedAt: null,
            });
            await expect(forumService.updatePost('post-1', 'user-1', {})).rejects.toThrow(AppError);
        });

        it('should allow admin to update any post', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                userId: 'other',
                deletedAt: null,
            });
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({ user: null, category: null });
            const result = await forumService.updatePost(
                'post-1',
                'admin',
                { title: 'Admin update' },
                true
            );
            expect(result).toBeDefined();
        });
    });

    // =========================================================================
    // deletePost
    // =========================================================================
    describe('deletePost', () => {
        it('should soft delete own post', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                userId: 'user-1',
                deletedAt: null,
            });
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

            await forumService.deletePost('post-1', 'user-1', false);

            expect(prisma.forumPost.update).toHaveBeenCalledWith({
                where: { id: 'post-1' },
                data: { deletedAt: expect.any(Date), status: 'deleted' },
            });
        });

        it('should throw 403 if not owner/admin', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                userId: 'other',
                deletedAt: null,
            });
            await expect(forumService.deletePost('post-1', 'user-1', false)).rejects.toThrow(AppError);
        });

        it('should allow admin to delete any post', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                userId: 'other',
                deletedAt: null,
            });
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});
            await forumService.deletePost('post-1', 'admin', true);
            expect(prisma.forumPost.update).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // addComment
    // =========================================================================
    describe('addComment', () => {
        it('should add comment and return shaped response with author', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                deletedAt: null,
                isLocked: false,
            });
            const created = {
                id: 'comment-1',
                content: 'Nice',
                user: mockAuthor,
            };
            (prisma.forumComment.create as jest.Mock).mockResolvedValue(created);
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

            const result = await forumService.addComment('post-1', 'user-1', { content: 'Nice' });

            expect(prisma.forumComment.create).toHaveBeenCalled();
            expect(prisma.forumPost.update).toHaveBeenCalledWith({
                where: { id: 'post-1' },
                data: { commentCount: { increment: 1 } },
            });
            expect(result).toEqual({
                id: 'comment-1',
                content: 'Nice',
                author: mockAuthor,
                userVote: null,
                replies: [],
            });
            expect((result as any).user).toBeUndefined();
        });

        it('should throw 404 if post not found', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(forumService.addComment('bad', 'user', { content: 'x' })).rejects.toThrow(
                AppError
            );
        });

        it('should throw 422 if post is locked', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                deletedAt: null,
                isLocked: true,
            });
            await expect(
                forumService.addComment('post-1', 'user', { content: 'x' })
            ).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    // getComments
    // =========================================================================
    describe('getComments', () => {
        it('should return only top-level comments with nested replies', async () => {
            const mockComments = [
                {
                    id: 'c1',
                    content: 'Hello',
                    parentCommentId: null,
                    user: mockAuthor,
                    replies: [
                        {
                            id: 'c1-r1',
                            content: 'Reply',
                            parentCommentId: 'c1',
                            user: mockAuthor,
                        },
                    ],
                },
            ];
            (prisma.forumComment.findMany as jest.Mock).mockResolvedValue(mockComments);
            (prisma.forumComment.count as jest.Mock).mockResolvedValue(1);
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([]);

            const result = await forumService.getComments('post-1', { page: 1, limit: 10 });

            const whereArg = (prisma.forumComment.findMany as jest.Mock).mock.calls[0][0].where;
            // The critical fix: only top-level comments at the top
            expect(whereArg).toMatchObject({
                postId: 'post-1',
                parentCommentId: null,
                deletedAt: null,
                status: 'published',
            });
            expect(result.comments).toHaveLength(1);
            expect(result.comments[0].replies).toHaveLength(1);
            expect(result.comments[0].replies[0].author).toEqual(mockAuthor);
            expect(result.comments[0].replies[0].userVote).toBeNull();
            expect(result.total).toBe(1);
        });

        it('should return empty replies array when there are none', async () => {
            const mockComments = [
                { id: 'c1', content: 'Standalone', parentCommentId: null, user: mockAuthor, replies: [] },
            ];
            (prisma.forumComment.findMany as jest.Mock).mockResolvedValue(mockComments);
            (prisma.forumComment.count as jest.Mock).mockResolvedValue(1);
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([]);

            const result = await forumService.getComments('post-1', { page: 1, limit: 10 });

            expect(result.comments[0].replies).toEqual([]);
        });

        it('should inject userVote for top-level and nested comments', async () => {
            const mockComments = [
                {
                    id: 'c1',
                    content: 'Hello',
                    user: mockAuthor,
                    replies: [
                        { id: 'r1', content: 'Reply', user: mockAuthor },
                    ],
                },
            ];
            (prisma.forumComment.findMany as jest.Mock).mockResolvedValue(mockComments);
            (prisma.forumComment.count as jest.Mock).mockResolvedValue(1);
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([
                { targetId: 'c1', voteType: 1 },
                { targetId: 'r1', voteType: -1 },
            ]);

            const result = await forumService.getComments('post-1', { page: 1, limit: 10 }, 'user-1');

            expect(result.comments[0].userVote).toBe('up');
            expect(result.comments[0].replies[0].userVote).toBe('down');
        });
    });

    // =========================================================================
    // updateComment
    // =========================================================================
    describe('updateComment', () => {
        it('should update own comment and return shaped response', async () => {
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({
                id: 'c1',
                userId: 'user-1',
                deletedAt: null,
            });
            const updated = {
                id: 'c1',
                content: 'Updated',
                isEdited: true,
                user: mockAuthor,
            };
            (prisma.forumComment.update as jest.Mock).mockResolvedValue(updated);

            const result = await forumService.updateComment('c1', 'user-1', { content: 'Updated' }, false);

            expect((result as any).content).toBe('Updated');
            expect(prisma.forumComment.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'c1' },
                    data: { content: 'Updated', isEdited: true },
                    include: expect.objectContaining({
                        user: expect.objectContaining({ select: expect.any(Object) }),
                    }),
                })
            );
            expect((result as any).author).toEqual(mockAuthor);
            expect((result as any).user).toBeUndefined();
        });

        it('should throw 403 if not owner', async () => {
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({
                id: 'c1',
                userId: 'other',
                deletedAt: null,
            });
            await expect(forumService.updateComment('c1', 'user-1', {}, false)).rejects.toThrow(
                AppError
            );
        });
    });

    // =========================================================================
    // deleteComment
    // =========================================================================
    describe('deleteComment', () => {
        it('should soft delete comment and decrement count', async () => {
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({
                id: 'c1',
                userId: 'user-1',
                postId: 'p1',
                deletedAt: null,
            });
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
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({
                id: 'c1',
                userId: 'other',
                deletedAt: null,
            });
            await expect(forumService.deleteComment('c1', 'user-1', false)).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    // vote
    // =========================================================================
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
            expect(prisma.forumPost.update).toHaveBeenCalled();
        });

        it('should throw 404 if target not found', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(forumService.vote('post', 'bad', 'user', 1)).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    // markBestAnswer
    // =========================================================================
    describe('markBestAnswer', () => {
        it('should mark answer and return shaped post with isSolved true', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', userId: 'user-1' });
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({ id: 'c1', postId: 'p1' });
            (prisma.forumComment.updateMany as jest.Mock).mockResolvedValue({});
            (prisma.forumComment.update as jest.Mock).mockResolvedValue({});
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({
                id: 'p1',
                userId: 'user-1',
                isSolved: true,
                user: mockAuthor,
                category: { id: 'cat-1', nameAr: 'عام', nameEn: 'General', slug: 'general' },
            });

            const result = await forumService.markBestAnswer('p1', 'c1', 'user-1');

            expect(prisma.forumComment.updateMany).toHaveBeenCalled();
            expect(prisma.forumComment.update).toHaveBeenCalledWith({
                where: { id: 'c1' },
                data: { isBestAnswer: true },
            });
            expect(prisma.forumPost.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'p1' },
                    data: { isSolved: true },
                    include: expect.objectContaining({
                        user: expect.objectContaining({ select: expect.any(Object) }),
                        category: expect.objectContaining({ select: expect.any(Object) }),
                    }),
                })
            );
            expect(result.isSolved).toBe(true);
            expect(result.author).toEqual(mockAuthor);
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

    // =========================================================================
    // searchPosts
    // =========================================================================
    describe('searchPosts', () => {
        it('should search posts and return shaped response', async () => {
            const mockPosts = [{ id: 'p1', title: 'Test', user: mockAuthor }];
            (prisma.forumPost.findMany as jest.Mock).mockResolvedValue(mockPosts);
            (prisma.forumPost.count as jest.Mock).mockResolvedValue(1);
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([]);

            const result = await forumService.searchPosts('test', { page: 1, limit: 10 });

            const whereArg = (prisma.forumPost.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg.OR).toBeDefined();
            expect(result.posts).toHaveLength(1);
            expect(result.posts[0].author).toEqual(mockAuthor);
            expect(result.total).toBe(1);
        });

        it('should inject userVote for authenticated search', async () => {
            (prisma.forumPost.findMany as jest.Mock).mockResolvedValue([
                { id: 'p1', user: mockAuthor },
            ]);
            (prisma.forumPost.count as jest.Mock).mockResolvedValue(1);
            (prisma.forumVote.findMany as jest.Mock).mockResolvedValue([
                { targetId: 'p1', voteType: 1 },
            ]);

            const result = await forumService.searchPosts('test', { page: 1, limit: 10 }, 'user-1');

            expect(result.posts[0].userVote).toBe('up');
        });
    });

    // =========================================================================
    // reportPost
    // =========================================================================
    describe('reportPost', () => {
        it('should create a report and increment flaggedCount', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                userId: 'other-user',
                deletedAt: null,
            });
            (prisma.forumReport.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.forumReport.create as jest.Mock).mockResolvedValue({
                id: 'report-1',
                postId: 'post-1',
                reporterId: 'user-1',
                reason: 'spam',
            });
            (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

            const result = await forumService.reportPost('post-1', 'user-1', 'spam');

            expect(prisma.forumReport.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    postId: 'post-1',
                    reporterId: 'user-1',
                    reason: 'spam',
                }),
            });
            expect(prisma.forumPost.update).toHaveBeenCalledWith({
                where: { id: 'post-1' },
                data: { flaggedCount: { increment: 1 } },
            });
            expect(result).toEqual(expect.objectContaining({ id: 'report-1' }));
        });

        it('should throw 400 when reporting own post', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                userId: 'user-1',
                deletedAt: null,
            });
            await expect(forumService.reportPost('post-1', 'user-1', 'spam')).rejects.toThrow(
                AppError
            );
        });

        it('should throw 400 when reason is invalid', async () => {
            await expect(
                forumService.reportPost('post-1', 'user-1', 'not-a-reason')
            ).rejects.toThrow(AppError);
        });

        it('should throw 404 when post not found', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(forumService.reportPost('post-1', 'user-1', 'spam')).rejects.toThrow(
                AppError
            );
        });

        it('should throw 404 when post is deleted', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                userId: 'other',
                deletedAt: new Date(),
            });
            await expect(forumService.reportPost('post-1', 'user-1', 'spam')).rejects.toThrow(
                AppError
            );
        });

        it('should throw 409 when already reported', async () => {
            (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
                id: 'post-1',
                userId: 'other',
                deletedAt: null,
            });
            (prisma.forumReport.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });
            await expect(forumService.reportPost('post-1', 'user-1', 'spam')).rejects.toThrow(
                AppError
            );
        });
    });

    // =========================================================================
    // reportComment
    // =========================================================================
    describe('reportComment', () => {
        it('should create a comment report', async () => {
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({
                id: 'comment-1',
                userId: 'other-user',
                deletedAt: null,
            });
            (prisma.forumReport.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.forumReport.create as jest.Mock).mockResolvedValue({
                id: 'report-2',
                commentId: 'comment-1',
                reporterId: 'user-1',
            });

            const result = await forumService.reportComment('comment-1', 'user-1', 'harassment');

            expect(prisma.forumReport.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    commentId: 'comment-1',
                    reporterId: 'user-1',
                    reason: 'harassment',
                }),
            });
            expect(result).toEqual(expect.objectContaining({ id: 'report-2' }));
        });

        it('should throw 400 when reporting own comment', async () => {
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({
                id: 'comment-1',
                userId: 'user-1',
                deletedAt: null,
            });
            await expect(
                forumService.reportComment('comment-1', 'user-1', 'spam')
            ).rejects.toThrow(AppError);
        });

        it('should throw 409 on duplicate report', async () => {
            (prisma.forumComment.findUnique as jest.Mock).mockResolvedValue({
                id: 'comment-1',
                userId: 'other',
                deletedAt: null,
            });
            (prisma.forumReport.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });
            await expect(
                forumService.reportComment('comment-1', 'user-1', 'spam')
            ).rejects.toThrow(AppError);
        });
    });
});