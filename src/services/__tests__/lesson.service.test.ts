import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as lessonService from '../lesson.service';

jest.mock('../../config/database', () => ({
    prisma: {
        module: { findUnique: jest.fn() },
        lesson: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        lessonProgress: { findUnique: jest.fn() },
        user: { findUnique: jest.fn() },
        childSettings: { findUnique: jest.fn() },
    },
}));

describe('Lesson Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createLesson', () => {
        it('should create lesson if module exists', async () => {
            const mockModule = { id: 'mod-1' };
            const mockData = { moduleId: 'mod-1', title: 'Lesson 1' };
            const mockLesson = { id: 'les-1', ...mockData };
            (prisma.module.findUnique as jest.Mock).mockResolvedValue(mockModule);
            (prisma.lesson.create as jest.Mock).mockResolvedValue(mockLesson);

            const result = await lessonService.createLesson(mockData);
            expect(prisma.lesson.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ moduleId: 'mod-1', title: 'Lesson 1' }),
            });
            expect(result).toEqual(mockLesson);
        });

        it('should throw 404 if module not found', async () => {
            (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(lessonService.createLesson({ moduleId: 'bad' })).rejects.toThrow(AppError);
        });
    });

    describe('listLessons', () => {
        it('should return published lessons for a module', async () => {
            const mockLessons = [{ id: 'l1', title: 'A' }];
            (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1' });
            (prisma.lesson.findMany as jest.Mock).mockResolvedValue(mockLessons);

            const result = await lessonService.listLessons('mod-1');
            expect(prisma.lesson.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { moduleId: 'mod-1', isPublished: true },
                })
            );
            expect(result).toEqual(mockLessons);
        });

        it('should throw 404 if module not found', async () => {
            (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(lessonService.listLessons('bad')).rejects.toThrow(AppError);
        });
    });

    describe('getLessonById', () => {
        it('should return lesson with module and quiz questions without lock status for anonymous', async () => {
            const mockLesson = {
                id: 'l1',
                module: { id: 'mod-1', title: 'Module', pathId: 'path-1' },
                quizQuestions: [],
                isPublished: true,
            };
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);

            const result = await lessonService.getLessonById('l1');
            expect(prisma.lesson.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'l1' },
                    include: expect.objectContaining({ quizQuestions: true }),
                })
            );
            expect(result).toEqual({ ...mockLesson, lockStatus: null });
        });

        it('should throw 404 if not found or not published', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(lessonService.getLessonById('bad')).rejects.toThrow(AppError);
        });
    });

    describe('updateLesson', () => {
        it('should update lesson', async () => {
            const mockLesson = { id: 'l1', title: 'Updated' };
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'l1' });
            (prisma.lesson.update as jest.Mock).mockResolvedValue(mockLesson);

            const result = await lessonService.updateLesson('l1', { title: 'Updated' });
            expect(prisma.lesson.update).toHaveBeenCalledWith({
                where: { id: 'l1' },
                data: { title: 'Updated' },
            });
            expect(result).toEqual(mockLesson);
        });

        it('should throw 404 if lesson not found', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(lessonService.updateLesson('bad', {})).rejects.toThrow(AppError);
        });
    });

    describe('deleteLesson', () => {
        it('should delete lesson', async () => {
            const mockDeleted = { id: 'l1' };
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'l1' });
            (prisma.lesson.delete as jest.Mock).mockResolvedValue(mockDeleted);

            const result = await lessonService.deleteLesson('l1');
            expect(prisma.lesson.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
            expect(result).toEqual(mockDeleted);
        });

        it('should throw 404 if lesson not found', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(lessonService.deleteLesson('bad')).rejects.toThrow(AppError);
        });
    });

    describe('getLessonLockStatus', () => {
        const mockLesson = {
            id: 'l2',
            module: {
                lessons: [
                    { id: 'l1', title: 'Prev', order: 1, lockDurationHours: 12 },
                    { id: 'l2', title: 'Current', order: 2, lockDurationHours: 12 },
                ],
            },
        };

        it('should return unlocked for first lesson', async () => {
            const firstLesson = {
                id: 'l1',
                module: { lessons: [{ id: 'l1', order: 1, lockDurationHours: 12 }] },
            };
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(firstLesson);
            const result = await lessonService.getLessonLockStatus('l1', 'user1');
            expect(result.isLocked).toBe(false);
            expect(prisma.lessonProgress.findUnique).not.toHaveBeenCalled();
        });

        it('should lock if previous lesson not completed', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
            (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue(null);
            const result = await lessonService.getLessonLockStatus('l2', 'user1');
            expect(result.isLocked).toBe(true);
            expect(result.message).toContain('يجب إكمال الدرس السابق');
        });

        it('should lock if previous lesson completed but lock duration not passed', async () => {
            const completedAt = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago, lock 12h
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
            (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue({
                completed: true,
                completedAt,
                lastAccessedAt: completedAt,
            });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // no parent
            const result = await lessonService.getLessonLockStatus('l2', 'user1');
            expect(result.isLocked).toBe(true);
            expect(result.remainingSeconds).toBeGreaterThan(0);
        });

        it('should unlock if lock duration passed', async () => {
            const completedAt = new Date(Date.now() - 13 * 60 * 60 * 1000); // 13 hours ago, lock 12h
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
            (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue({
                completed: true,
                completedAt,
                lastAccessedAt: completedAt,
            });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            const result = await lessonService.getLessonLockStatus('l2', 'user1');
            expect(result.isLocked).toBe(false);
        });

        it('should respect parent override custom duration', async () => {
            const completedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago, custom 4h
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
            (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue({
                completed: true,
                completedAt,
                lastAccessedAt: completedAt,
            });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ parentId: 'parent-1' });
            (prisma.childSettings.findUnique as jest.Mock).mockResolvedValue({
                lockOverrideEnabled: true,
                customLockDurationHours: 4,
            });
            const result = await lessonService.getLessonLockStatus('l2', 'user1');
            expect(result.isLocked).toBe(true); // 2h < 4h
            expect(result.remainingSeconds).toBeGreaterThan(0);
        });
    });
});