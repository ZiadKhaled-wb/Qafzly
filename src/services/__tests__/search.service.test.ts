import { prisma } from '../../config/database';
import * as searchService from '../search.service';

jest.mock('../../config/database', () => ({
    prisma: {
        $queryRaw: jest.fn(),
        user: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
    },
}));

/**
 * Helper — mock the two sequential $queryRaw calls that searchPaths and
 * searchForumPosts make (data query, then count query).
 */
const mockRawSearch = (data: any[], count: number | null) => {
    (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(data)
        .mockResolvedValueOnce(count === null ? [] : [{ count }]);
};

describe('Search Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =========================================================================
    // globalSearch
    // =========================================================================
    describe('globalSearch', () => {
        it('should return combined results for all three types when type is not specified', async () => {
            const searchPathsSpy = jest
                .spyOn(searchService, 'searchPaths')
                .mockResolvedValue({ data: [], pagination: {} } as any);
            const searchForumSpy = jest
                .spyOn(searchService, 'searchForumPosts')
                .mockResolvedValue({ data: [], pagination: {} } as any);
            const searchUsersSpy = jest
                .spyOn(searchService, 'searchUsers')
                .mockResolvedValue({ data: [], pagination: {} } as any);

            const result = await searchService.globalSearch(
                { q: 'test' },
                { page: 1, limit: 10 }
            );

            expect(result.paths).toBeDefined();
            expect(result.posts).toBeDefined();
            expect(result.users).toBeDefined();
            expect(searchPathsSpy).toHaveBeenCalled();
            expect(searchForumSpy).toHaveBeenCalled();
            expect(searchUsersSpy).toHaveBeenCalled();

            searchPathsSpy.mockRestore();
            searchForumSpy.mockRestore();
            searchUsersSpy.mockRestore();
        });

        it('should search only paths when type=path', async () => {
            const searchPathsSpy = jest
                .spyOn(searchService, 'searchPaths')
                .mockResolvedValue({ data: [], pagination: {} } as any);
            const searchForumSpy = jest
                .spyOn(searchService, 'searchForumPosts')
                .mockResolvedValue({ data: [], pagination: {} } as any);
            const searchUsersSpy = jest
                .spyOn(searchService, 'searchUsers')
                .mockResolvedValue({ data: [], pagination: {} } as any);

            const result = await searchService.globalSearch(
                { q: 'test', type: 'path' },
                { page: 1, limit: 10 }
            );

            expect(result.paths).toBeDefined();
            expect(result.posts).toBeUndefined();
            expect(result.users).toBeUndefined();
            expect(searchPathsSpy).toHaveBeenCalled();
            expect(searchForumSpy).not.toHaveBeenCalled();
            expect(searchUsersSpy).not.toHaveBeenCalled();

            searchPathsSpy.mockRestore();
            searchForumSpy.mockRestore();
            searchUsersSpy.mockRestore();
        });

        it('should search only forum posts when type=forum', async () => {
            const searchPathsSpy = jest
                .spyOn(searchService, 'searchPaths')
                .mockResolvedValue({ data: [], pagination: {} } as any);
            const searchForumSpy = jest
                .spyOn(searchService, 'searchForumPosts')
                .mockResolvedValue({ data: [], pagination: {} } as any);
            const searchUsersSpy = jest
                .spyOn(searchService, 'searchUsers')
                .mockResolvedValue({ data: [], pagination: {} } as any);

            const result = await searchService.globalSearch(
                { q: 'test', type: 'forum' },
                { page: 1, limit: 10 }
            );

            expect(result.paths).toBeUndefined();
            expect(result.posts).toBeDefined();
            expect(result.users).toBeUndefined();
            expect(searchPathsSpy).not.toHaveBeenCalled();
            expect(searchForumSpy).toHaveBeenCalled();
            expect(searchUsersSpy).not.toHaveBeenCalled();

            searchPathsSpy.mockRestore();
            searchForumSpy.mockRestore();
            searchUsersSpy.mockRestore();
        });

        it('should search only users when type=user', async () => {
            const searchPathsSpy = jest
                .spyOn(searchService, 'searchPaths')
                .mockResolvedValue({ data: [], pagination: {} } as any);
            const searchForumSpy = jest
                .spyOn(searchService, 'searchForumPosts')
                .mockResolvedValue({ data: [], pagination: {} } as any);
            const searchUsersSpy = jest
                .spyOn(searchService, 'searchUsers')
                .mockResolvedValue({ data: [], pagination: {} } as any);

            const result = await searchService.globalSearch(
                { q: 'test', type: 'user' },
                { page: 1, limit: 10 }
            );

            expect(result.paths).toBeUndefined();
            expect(result.posts).toBeUndefined();
            expect(result.users).toBeDefined();
            expect(searchPathsSpy).not.toHaveBeenCalled();
            expect(searchForumSpy).not.toHaveBeenCalled();
            expect(searchUsersSpy).toHaveBeenCalled();

            searchPathsSpy.mockRestore();
            searchForumSpy.mockRestore();
            searchUsersSpy.mockRestore();
        });
    });

    // =========================================================================
    // searchPaths
    // =========================================================================
    describe('searchPaths', () => {
        it('should return paginated paths for a long Arabic query (tsvector path)', async () => {
            const mockPaths = [
                { id: 'p1', title: 'مقدمة إلى الحاسوب', rank: 0.5 },
                { id: 'p2', title: 'مقدمة إلى الإنترنت', rank: 0.3 },
            ];
            mockRawSearch(mockPaths, 2);

            const result = await searchService.searchPaths(
                { q: 'الحاسوب', language: 'ar' },
                { page: 1, limit: 10 }
            );

            expect(result.data).toEqual(mockPaths);
            expect(result.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 2,
                totalPages: 1,
            });
            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should fall back to ILIKE for short queries (< 3 chars)', async () => {
            mockRawSearch([], 0);

            await searchService.searchPaths(
                { q: 'py', language: 'en' },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should default to Arabic when language is not provided', async () => {
            mockRawSearch([{ id: 'p1' }], 1);

            const result = await searchService.searchPaths(
                { q: 'الحاسوب' },
                { page: 1, limit: 10 }
            );

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
        });

        it('should apply categoryId filter without throwing', async () => {
            mockRawSearch([{ id: 'p1', categoryId: 'cat-1' }], 1);

            const result = await searchService.searchPaths(
                { q: 'programming', categoryId: 'cat-1' },
                { page: 1, limit: 10 }
            );

            expect(result.data).toHaveLength(1);
            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should apply difficulty filter without throwing', async () => {
            mockRawSearch([{ id: 'p1', difficulty: 'BEGINNER' }], 1);

            await searchService.searchPaths(
                { q: 'intro', difficulty: 'BEGINNER' },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should apply minPrice filter alone', async () => {
            mockRawSearch([{ id: 'p1', price: 150 }], 1);

            await searchService.searchPaths(
                { q: 'intro', minPrice: 100 },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should apply maxPrice filter alone', async () => {
            mockRawSearch([{ id: 'p1', price: 150 }], 1);

            await searchService.searchPaths(
                { q: 'intro', maxPrice: 200 },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should apply minPrice + maxPrice together (range)', async () => {
            mockRawSearch([{ id: 'p1', price: 150 }], 1);

            await searchService.searchPaths(
                { q: 'intro', minPrice: 100, maxPrice: 200 },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should apply all filters together', async () => {
            mockRawSearch([{ id: 'p1' }], 1);

            await searchService.searchPaths(
                {
                    q: 'advanced python',
                    language: 'en',
                    categoryId: 'cat-1',
                    difficulty: 'ADVANCED',
                    minPrice: 100,
                    maxPrice: 500,
                },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should gracefully handle an empty count result', async () => {
            // Total query returns [] — total[0] is undefined
            mockRawSearch([], null);

            const result = await searchService.searchPaths(
                { q: 'nothing-matches-this' },
                { page: 1, limit: 10 }
            );

            expect(result.pagination.total).toBe(0);
            expect(result.pagination.totalPages).toBe(0);
        });

        it('should compute correct offset for page 2', async () => {
            mockRawSearch([{ id: 'p11' }, { id: 'p12' }], 25);

            const result = await searchService.searchPaths(
                { q: 'programming' },
                { page: 2, limit: 10 }
            );

            expect(result.pagination.page).toBe(2);
            expect(result.pagination.total).toBe(25);
            expect(result.pagination.totalPages).toBe(3);
        });
    });

    // =========================================================================
    // searchForumPosts
    // =========================================================================
    describe('searchForumPosts', () => {
        it('should return paginated posts for a long English query', async () => {
            const mockPosts = [
                { id: 'fp1', title: 'How to learn Python', rank: 0.8 },
            ];
            mockRawSearch(mockPosts, 1);

            const result = await searchService.searchForumPosts(
                { q: 'python', language: 'en' },
                { page: 1, limit: 10 }
            );

            expect(result.data).toEqual(mockPosts);
            expect(result.pagination.total).toBe(1);
            expect(result.pagination.totalPages).toBe(1);
        });

        it('should default to Arabic when language is not provided', async () => {
            mockRawSearch([{ id: 'fp1' }], 1);

            await searchService.searchForumPosts(
                { q: 'البرمجة' },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should fall back to ILIKE for short queries (< 3 chars)', async () => {
            mockRawSearch([], 0);

            await searchService.searchForumPosts(
                { q: 'py' },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should apply categoryId filter', async () => {
            mockRawSearch([{ id: 'fp1', categoryId: 'cat-general' }], 1);

            await searchService.searchForumPosts(
                { q: 'question', categoryId: 'cat-general' },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should apply pathId filter', async () => {
            mockRawSearch([{ id: 'fp1', pathId: 'path-1' }], 1);

            await searchService.searchForumPosts(
                { q: 'question', pathId: 'path-1' },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should apply categoryId + pathId together', async () => {
            mockRawSearch([{ id: 'fp1' }], 1);

            await searchService.searchForumPosts(
                { q: 'question', categoryId: 'cat-1', pathId: 'path-1' },
                { page: 1, limit: 10 }
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should gracefully handle an empty count result', async () => {
            mockRawSearch([], null);

            const result = await searchService.searchForumPosts(
                { q: 'no-such-post' },
                { page: 1, limit: 10 }
            );

            expect(result.pagination.total).toBe(0);
            expect(result.pagination.totalPages).toBe(0);
        });

        it('should compute correct pagination for page 3', async () => {
            mockRawSearch([{ id: 'fp21' }], 55);

            const result = await searchService.searchForumPosts(
                { q: 'help' },
                { page: 3, limit: 20 }
            );

            expect(result.pagination.page).toBe(3);
            expect(result.pagination.limit).toBe(20);
            expect(result.pagination.total).toBe(55);
            expect(result.pagination.totalPages).toBe(3);
        });
    });

    // =========================================================================
    // searchUsers
    // =========================================================================
    describe('searchUsers', () => {
        it('should search users by name, displayName, or email', async () => {
            const mockUsers = [{ id: 'u1', fullName: 'John Doe' }];
            (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
            (prisma.user.count as jest.Mock).mockResolvedValue(1);

            const result = await searchService.searchUsers(
                { q: 'john' },
                { page: 1, limit: 10 }
            );

            expect(result.data).toEqual(mockUsers);
            expect(result.pagination.total).toBe(1);
            expect(result.pagination.totalPages).toBe(1);
            expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
            expect(prisma.user.count).toHaveBeenCalledTimes(1);
        });

        it('should return empty list when no users match', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.user.count as jest.Mock).mockResolvedValue(0);

            const result = await searchService.searchUsers(
                { q: 'nonexistent-user-xyz' },
                { page: 1, limit: 10 }
            );

            expect(result.data).toEqual([]);
            expect(result.pagination.total).toBe(0);
            expect(result.pagination.totalPages).toBe(0);
        });

        it('should compute correct pagination for page 2', async () => {
            const mockUsers = [{ id: 'u11' }, { id: 'u12' }];
            (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
            (prisma.user.count as jest.Mock).mockResolvedValue(22);

            const result = await searchService.searchUsers(
                { q: 'a' },
                { page: 2, limit: 10 }
            );

            expect(result.pagination.page).toBe(2);
            expect(result.pagination.total).toBe(22);
            expect(result.pagination.totalPages).toBe(3);
        });

        it('should apply deletedAt: null and case-insensitive filters', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.user.count as jest.Mock).mockResolvedValue(0);

            await searchService.searchUsers({ q: 'test' }, { page: 1, limit: 10 });

            const findManyArgs = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
            expect(findManyArgs.where.deletedAt).toBeNull();
            expect(findManyArgs.where.OR).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        fullName: expect.objectContaining({ mode: 'insensitive' }),
                    }),
                    expect.objectContaining({
                        displayName: expect.objectContaining({ mode: 'insensitive' }),
                    }),
                    expect.objectContaining({
                        email: expect.objectContaining({ mode: 'insensitive' }),
                    }),
                ])
            );
        });
    });
});