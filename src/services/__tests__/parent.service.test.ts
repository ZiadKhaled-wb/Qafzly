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
    },
}));

describe('Parent Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('addChild', () => {
        it('should link child to parent if valid', async () => {
            (prisma.user.findUnique as jest.Mock)
                .mockResolvedValueOnce({ id: 'parent-1', role: 'PARENT', deletedAt: null })
                .mockResolvedValueOnce({ id: 'child-1', role: 'STUDENT', deletedAt: null, parentId: null });
            (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'child-1', parentId: 'parent-1' });

            const result = await parentService.addChild('parent-1', 'child-1');

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'child-1' },
                data: { parentId: 'parent-1' },
                select: expect.any(Object),
            });
            expect(result.parentId).toBe('parent-1');
        });

        it('should throw 403 if parent is not PARENT role', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'user-1', role: 'STUDENT', deletedAt: null });
            await expect(parentService.addChild('user-1', 'child-1')).rejects.toThrow(AppError);
        });

        it('should throw 400 if child already has parent', async () => {
            (prisma.user.findUnique as jest.Mock)
                .mockResolvedValueOnce({ id: 'parent-1', role: 'PARENT', deletedAt: null })
                .mockResolvedValueOnce({ id: 'child-1', role: 'STUDENT', deletedAt: null, parentId: 'other-parent' });
            await expect(parentService.addChild('parent-1', 'child-1')).rejects.toThrow(AppError);
        });
    });

    describe('removeChild', () => {
        it('should unlink child and delete settings', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'child-1', parentId: 'parent-1' });
            (prisma.childSettings.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
            (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'child-1', parentId: null });

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
            await expect(parentService.removeChild('parent-1', 'child-1')).rejects.toThrow(AppError);
        });
    });

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
            await expect(parentService.getChildProgress('parent-1', 'child-1')).rejects.toThrow(AppError);
        });
    });

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
            await expect(parentService.getChildPerformance('parent-1', 'child-1')).rejects.toThrow(AppError);
        });
    });

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
            await expect(parentService.getChildTimeTracking('parent-1', 'child-1')).rejects.toThrow(AppError);
        });
    });

    describe('getChildSettings', () => {
        it('should return default settings if none exist', async () => {
            (prisma.childSettings.findUnique as jest.Mock).mockResolvedValue(null);
            const result = await parentService.getChildSettings('parent-1', 'child-1');
            expect(result).toEqual({ lockOverrideEnabled: false, customLockDurationHours: null });
        });

        it('should return existing settings', async () => {
            (prisma.childSettings.findUnique as jest.Mock).mockResolvedValue({
                lockOverrideEnabled: true,
                customLockDurationHours: 6,
            });
            const result = await parentService.getChildSettings('parent-1', 'child-1');
            expect(result.lockOverrideEnabled).toBe(true);
            expect(result.customLockDurationHours).toBe(6);
        });
    });

    describe('updateChildSettings', () => {
        it('should upsert settings', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'child-1' });
            (prisma.childSettings.upsert as jest.Mock).mockResolvedValue({
                lockOverrideEnabled: true,
                customLockDurationHours: 4,
            });

            const result = await parentService.updateChildSettings('parent-1', 'child-1', {
                lockOverrideEnabled: true,
                customLockDurationHours: 4,
            });
            expect(prisma.childSettings.upsert).toHaveBeenCalled();
            expect(result.lockOverrideEnabled).toBe(true);
        });

        it('should throw 404 if child not linked', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(parentService.updateChildSettings('parent-1', 'child-1', {})).rejects.toThrow(AppError);
        });
    });
});