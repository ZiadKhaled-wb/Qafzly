import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as questService from '../quest.service';
import { awardXpWithRecharge } from '../recharge.service';

jest.mock('../../config/database', () => ({
    prisma: {
        lesson: { findUnique: jest.fn() },
        questCheckpoint: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        userQuestProgress: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
        },
    },
}));

jest.mock('../recharge.service', () => ({
    awardXpWithRecharge: jest.fn(),
}));

describe('Quest Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createCheckpoint', () => {
        it('should create checkpoint with auto order', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
            (prisma.questCheckpoint.count as jest.Mock).mockResolvedValue(1);
            (prisma.questCheckpoint.create as jest.Mock).mockResolvedValue({ id: 'cp-1', order: 2 });

            const result = await questService.createCheckpoint('lesson-1', { titleAr: 'Step 1', taskAr: 'Do something' });
            expect(prisma.questCheckpoint.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ order: 2, xpAward: 15 }) })
            );
            expect(result.id).toBe('cp-1');
        });

        it('should throw 404 if lesson not found', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(questService.createCheckpoint('bad', {})).rejects.toThrow(AppError);
        });
    });

    describe('updateCheckpoint', () => {
        it('should update checkpoint', async () => {
            (prisma.questCheckpoint.findUnique as jest.Mock).mockResolvedValue({ id: 'cp-1' });
            (prisma.questCheckpoint.update as jest.Mock).mockResolvedValue({ id: 'cp-1', titleAr: 'Updated' });

            const result = await questService.updateCheckpoint('cp-1', { titleAr: 'Updated' });
            expect(result.titleAr).toBe('Updated');
        });

        it('should throw 404 if not found', async () => {
            (prisma.questCheckpoint.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(questService.updateCheckpoint('bad', {})).rejects.toThrow(AppError);
        });
    });

    describe('deleteCheckpoint', () => {
        it('should delete checkpoint', async () => {
            (prisma.questCheckpoint.findUnique as jest.Mock).mockResolvedValue({ id: 'cp-1' });
            await questService.deleteCheckpoint('cp-1');
            expect(prisma.questCheckpoint.delete).toHaveBeenCalledWith({ where: { id: 'cp-1' } });
        });

        it('should throw 404 if not found', async () => {
            (prisma.questCheckpoint.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(questService.deleteCheckpoint('bad')).rejects.toThrow(AppError);
        });
    });

    describe('reorderCheckpoints', () => {
        it('should reorder checkpoints', async () => {
            (prisma.questCheckpoint.findMany as jest.Mock).mockResolvedValue([{ id: 'cp1' }, { id: 'cp2' }]);
            await questService.reorderCheckpoints('lesson-1', ['cp2', 'cp1']);
            expect(prisma.questCheckpoint.update).toHaveBeenCalledTimes(2);
        });

        it('should throw 400 for unknown id', async () => {
            (prisma.questCheckpoint.findMany as jest.Mock).mockResolvedValue([{ id: 'cp1' }]);
            await expect(questService.reorderCheckpoints('lesson-1', ['cp1', 'bad'])).rejects.toThrow(AppError);
        });
    });

    describe('getCheckpointsForLesson', () => {
        it('should return checkpoints without completion', async () => {
            const mockCheckpoints = [{ id: 'cp1', order: 1 }];
            (prisma.questCheckpoint.findMany as jest.Mock).mockResolvedValue(mockCheckpoints);

            const result = await questService.getCheckpointsForLesson('lesson-1');
            expect(result).toEqual(mockCheckpoints);
            expect(prisma.userQuestProgress.findMany).not.toHaveBeenCalled();
        });

        it('should return with completion for user', async () => {
            const mockCheckpoints = [{ id: 'cp1', order: 1 }, { id: 'cp2', order: 2 }];
            (prisma.questCheckpoint.findMany as jest.Mock).mockResolvedValue(mockCheckpoints);
            (prisma.userQuestProgress.findMany as jest.Mock).mockResolvedValue([{ checkpointId: 'cp1', completed: true }]);

            const result = await questService.getCheckpointsForLesson('lesson-1', 'user-1') as any[];
            expect(result[0].completed).toBe(true);
            expect(result[1].completed).toBe(false);
        });
    });

    describe('completeCheckpoint', () => {
        it('should complete checkpoint, award XP via recharge, and detect quest completion', async () => {
            (prisma.questCheckpoint.findFirst as jest.Mock).mockResolvedValue({ id: 'cp1', xpAward: 15 });
            (prisma.userQuestProgress.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.userQuestProgress.upsert as jest.Mock).mockResolvedValue({});
            (prisma.questCheckpoint.findMany as jest.Mock).mockResolvedValue([{ id: 'cp1', order: 1 }, { id: 'cp2', order: 2 }]);
            (prisma.userQuestProgress.findMany as jest.Mock).mockResolvedValue([{ checkpointId: 'cp1' }, { checkpointId: 'cp2' }]);
            (awardXpWithRecharge as jest.Mock).mockResolvedValue(15);

            const result = await questService.completeCheckpoint('lesson-1', 'cp1', 'user-1', { completed: true });
            expect(result.xpEarned).toBe(15);
            expect(result.questCompleted).toBe(true);
            expect(result.nextCheckpoint).toBeNull();
            expect(awardXpWithRecharge).toHaveBeenCalledWith('user-1', 15, 'lesson-1');
        });

        it('should throw 400 if already completed', async () => {
            (prisma.questCheckpoint.findFirst as jest.Mock).mockResolvedValue({ id: 'cp1' });
            (prisma.userQuestProgress.findUnique as jest.Mock).mockResolvedValue({ completed: true });
            await expect(questService.completeCheckpoint('lesson-1', 'cp1', 'user-1', { completed: true })).rejects.toThrow(AppError);
        });

        it('should return next checkpoint if quest not complete', async () => {
            (prisma.questCheckpoint.findFirst as jest.Mock).mockResolvedValue({ id: 'cp1', xpAward: 15 });
            (prisma.userQuestProgress.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.questCheckpoint.findMany as jest.Mock).mockResolvedValue([
                { id: 'cp1', order: 1, titleAr: 'cp1' },
                { id: 'cp2', order: 2, titleAr: 'cp2' },
            ]);
            (prisma.userQuestProgress.findMany as jest.Mock).mockResolvedValue([{ checkpointId: 'cp1' }]);
            (awardXpWithRecharge as jest.Mock).mockResolvedValue(15);

            const result = await questService.completeCheckpoint('lesson-1', 'cp1', 'user-1', { completed: true });
            expect(result.questCompleted).toBe(false);
            expect(result.nextCheckpoint).toEqual({ id: 'cp2', titleAr: 'cp2', order: 2 });
        });
    });
});