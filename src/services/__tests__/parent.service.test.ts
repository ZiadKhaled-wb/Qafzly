import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as parentService from '../parent.service';

jest.mock('../../config/database', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
        childSettings: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            deleteMany: jest.fn(),
        },
        lessonProgress: {
            findMany: jest.fn(),
        },
        purchase: { findMany: jest.fn() },
        // NOTE: `subscription` removed — the model is deprecated.
    },
}));

describe('Parent Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =========================================================================
    describe('addChild', () => {
        const parentMock = { id: 'parent-1', role: 'PARENT', deletedAt: null };
        const childMock = { id: 'child-1', role: 'STUDENT', deletedAt: null, parentId: null };

        it('should link child by childId', async () => {
            (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === 'parent-1') return Promise.resolve(parentMock);
                if (where.id === 'child-1') return Promise.resolve(childMock);
                return Promise.resolve(null);
            });
            (prisma.user.update as jest.Mock).mockResolvedValue({
                id: 'child-1',
                parentId: 'parent-1',
            });

            const result = await parentService.addChild('parent-1', { childId: 'child-1' });

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'child-1' },
                data: { parentId: 'parent-1' },
                select: expect.any(Object),
            });
            expect(result.parentId).toBe('parent-1');
        });

        it('should link child by email', async () => {
            (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === 'parent-1') return Promise.resolve(parentMock);
                if (where.email === 'child@test.com') return Promise.resolve(childMock);
                return Promise.resolve(null);
            });
            (prisma.user.update as jest.Mock).mockResolvedValue({
                id: 'child-1',
                parentId: 'parent-1',
            });

            const result = await parentService.addChild('parent-1', {
                email: 'child@test.com',
            });

            expect(prisma.user.update).toHaveBeenCalled();
            expect(result.parentId).toBe('parent-1');
        });

        it('should throw 404 if email does not resolve to a user', async () => {
            (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === 'parent-1') return Promise.resolve(parentMock);
                return Promise.resolve(null);
            });

            await expect(
                parentService.addChild('parent-1', { email: 'nobody@test.com' })
            ).rejects.toThrow('لا يوجد مستخدم بهذا البريد الإلكتروني');
        });

        it('should throw 400 if email resolves to non-STUDENT', async () => {
            (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === 'parent-1') return Promise.resolve(parentMock);
                if (where.email === 'teacher@test.com') {
                    return Promise.resolve({ id: 'x', role: 'ADMIN', deletedAt: null });
                }
                return Promise.resolve(null);
            });

            await expect(
                parentService.addChild('parent-1', { email: 'teacher@test.com' })
            ).rejects.toThrow('المستخدم المحدد ليس طالبًا');
        });

        it('should throw 403 if parent is not PARENT role', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
                id: 'user-1',
                role: 'STUDENT',
                deletedAt: null,
            });
            await expect(
                parentService.addChild('user-1', { childId: 'child-1' })
            ).rejects.toThrow(AppError);
        });

        it('should throw 409 if child already has a parent', async () => {
            (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === 'parent-1') return Promise.resolve(parentMock);
                if (where.id === 'child-1') {
                    return Promise.resolve({
                        ...childMock,
                        parentId: 'other-parent',
                    });
                }
                return Promise.resolve(null);
            });

            await expect(
                parentService.addChild('parent-1', { childId: 'child-1' })
            ).rejects.toThrow('هذا الطفل مرتبط بالفعل بمستخدم آخر');
        });

        it('should throw 400 if parent tries to link themselves', async () => {
            (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => {
                if (where.id === 'parent-1') return Promise.resolve(parentMock);
                return Promise.resolve(null);
            });

            await expect(
                parentService.addChild('parent-1', { childId: 'parent-1' })
            ).rejects.toThrow('لا يمكنك ربط نفسك');
        });

        it('should throw 400 if neither childId nor email is provided (defensive)', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(parentMock);

            await expect(parentService.addChild('parent-1', {})).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('removeChild', () => {
        it('should unlink child and delete settings', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({
                id: 'child-1',
                parentId: 'parent-1',
            });
            (prisma.childSettings.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.user.update as jest.Mock).mockResolvedValue({
                id: 'child-1',
                parentId: null,
            });

            await parentService.removeChild('parent-1', 'child-1');

            expect(prisma.childSettings.deleteMany).toHaveBeenCalledWith({
                where: { parentId: 'parent-1', childId: 'child-1' },
            });
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'child-1' },
                data: { parentId: null },
            });
        });

        it('should throw 404 if child not linked to parent', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(parentService.removeChild('parent-1', 'child-1')).rejects.toThrow(
                AppError
            );
        });
    });

    // =========================================================================
    describe('listChildren', () => {
        it('should return children for parent', async () => {
            const mockChildren = [{ id: 'child-1', fullName: 'Child 1' }];
            (prisma.user.findMany as jest.Mock).mockResolvedValue(mockChildren);

            const result = await parentService.listChildren('parent-1');
            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: { parentId: 'parent-1', deletedAt: null },
                select: expect.any(Object),
                orderBy: { fullName: 'asc' },
            });
            expect(result).toEqual(mockChildren);
        });
    });

    // =========================================================================
    describe('getChildProgress', () => {
        it('should return aggregated progress', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'child-1' });
            (prisma.lessonProgress.findMany as jest.Mock).mockResolvedValue([
                { completed: true, timeSpent: 100 },
                { completed: true, timeSpent: 50 },
                { completed: false, timeSpent: 20 },
            ]);

            const result = await parentService.getChildProgress('parent-1', 'child-1');
            expect(result.totalLessonsCompleted).toBe(2);
            expect(result.totalTimeSpent).toBe(170);
            expect(result.progress).toHaveLength(3);
        });

        it('should throw 404 if child not linked', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(
                parentService.getChildProgress('parent-1', 'child-1')
            ).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('getChildPerformance', () => {
        it('should return quiz scores and challenges', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'child-1' });
            (prisma.lessonProgress.findMany as jest.Mock)
                .mockResolvedValueOnce([{ lessonId: 'l1', quizScore: 90 }])
                .mockResolvedValueOnce([{ lessonId: 'l2', completedAt: new Date() }]);

            const result = await parentService.getChildPerformance('parent-1', 'child-1');
            expect(result.quizScores).toHaveLength(1);
            expect(result.challenges).toHaveLength(1);
        });

        it('should throw 404 if child not linked', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(
                parentService.getChildPerformance('parent-1', 'child-1')
            ).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('getChildTimeTracking', () => {
        it('should return time tracking data', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'child-1' });
            (prisma.lessonProgress.findMany as jest.Mock).mockResolvedValue([
                { lessonId: 'l1', timeSpent: 120, lastAccessedAt: new Date() },
            ]);

            const result = await parentService.getChildTimeTracking('parent-1', 'child-1');
            expect(result).toHaveLength(1);
        });

        it('should throw 404 if child not linked', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(
                parentService.getChildTimeTracking('parent-1', 'child-1')
            ).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('getChildSettings', () => {
        it('should return flat defaults if no settings row exists', async () => {
            (prisma.childSettings.findUnique as jest.Mock).mockResolvedValue(null);
            const result = await parentService.getChildSettings('parent-1', 'child-1');
            expect(result).toEqual({
                lockOverrideEnabled: false,
                customLockDurationHours: null,
            });
        });

        it('should return flat shape when settings row exists (no extra fields)', async () => {
            (prisma.childSettings.findUnique as jest.Mock).mockResolvedValue({
                lockOverrideEnabled: true,
                customLockDurationHours: 6,
            });
            const result = await parentService.getChildSettings('parent-1', 'child-1');
            expect(result).toEqual({
                lockOverrideEnabled: true,
                customLockDurationHours: 6,
            });
            // Must not leak id/parentId/createdAt/updatedAt
            expect(result).not.toHaveProperty('id');
            expect(result).not.toHaveProperty('parentId');
            expect(result).not.toHaveProperty('createdAt');
        });
    });

    // =========================================================================
    describe('updateChildSettings', () => {
        it('should upsert settings and return flat shape', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'child-1' });
            (prisma.childSettings.upsert as jest.Mock).mockResolvedValue({
                lockOverrideEnabled: true,
                customLockDurationHours: 4,
            });

            const result = await parentService.updateChildSettings('parent-1', 'child-1', {
                lockOverrideEnabled: true,
                customLockDurationHours: 4,
            });

            expect(prisma.childSettings.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    select: {
                        lockOverrideEnabled: true,
                        customLockDurationHours: true,
                    },
                })
            );
            expect(result).toEqual({
                lockOverrideEnabled: true,
                customLockDurationHours: 4,
            });
        });

        it('should throw 404 if child not linked', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(
                parentService.updateChildSettings('parent-1', 'child-1', {})
            ).rejects.toThrow(AppError);
        });
    });

    // =========================================================================
    describe('getParentOverview', () => {
        it('should return aggregate overview', async () => {
            const mockChildren = [
                {
                    id: 'child-1',
                    fullName: 'Child 1',
                    stats: { xp: 100, level: 2, updatedAt: new Date() },
                    createdAt: new Date(),
                },
                {
                    id: 'child-2',
                    fullName: 'Child 2',
                    stats: { xp: 50, level: 1, updatedAt: new Date() },
                    createdAt: new Date(),
                },
            ];
            (prisma.user.findMany as jest.Mock).mockResolvedValue(mockChildren);

            const result = await parentService.getParentOverview('parent-1');
            expect(result.totalChildren).toBe(2);
            expect(result.totalXP).toBe(150);
            expect(result.lastActiveChild).toBeDefined();
            // Confirm `level` is under `stats`, not top-level
            expect((result.children[0] as any).stats.level).toBe(2);
            expect((result.children[0] as any).level).toBeUndefined();
        });

        it('should handle a parent with no children', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
            const result = await parentService.getParentOverview('parent-1');
            expect(result.totalChildren).toBe(0);
            expect(result.totalXP).toBe(0);
            expect(result.lastActiveChild).toBeNull();
        });
    });

    // =========================================================================
    describe('getBilling', () => {
        it('should aggregate purchases across parent and linked children', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([
                { id: 'child-1' },
                { id: 'child-2' },
            ]);
            (prisma.purchase.findMany as jest.Mock).mockResolvedValue([
                {
                    id: 'pur-1',
                    userId: 'parent-1',
                    user: { id: 'parent-1', fullName: 'Parent' },
                },
                {
                    id: 'pur-2',
                    userId: 'child-1',
                    user: { id: 'child-1', fullName: 'Child 1' },
                },
                {
                    id: 'pur-3',
                    userId: 'child-2',
                    user: { id: 'child-2', fullName: 'Child 2' },
                },
            ]);

            const result = await parentService.getBilling('parent-1');

            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: { parentId: 'parent-1', deletedAt: null },
                select: { id: true },
            });
            expect(prisma.purchase.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: { in: ['parent-1', 'child-1', 'child-2'] } },
                    orderBy: { createdAt: 'desc' },
                })
            );
            expect(result.purchases).toHaveLength(3);
            expect(result).not.toHaveProperty('subscriptions');
        });

        it('should handle a parent with no children (only own purchases)', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.purchase.findMany as jest.Mock).mockResolvedValue([{ id: 'pur-1' }]);

            const result = await parentService.getBilling('parent-1');

            expect(prisma.purchase.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: { in: ['parent-1'] } },
                })
            );
            expect(result.purchases).toHaveLength(1);
        });
    });
});