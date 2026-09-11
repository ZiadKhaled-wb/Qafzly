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
        enrollment: { findFirst: jest.fn() },
    },
}));

describe('Lesson Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================
    // createLesson
    // ============================================================
    describe('createLesson', () => {
        it('should create lesson if module exists', async () => {
            const mockData = { moduleId: 'mod-1', title: 'Lesson 1' };
            const mockLesson = { id: 'les-1', ...mockData };
            (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1' });
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

    // ============================================================
    // listLessons — access flags
    // ============================================================
    describe('listLessons', () => {
        const mockLessons = [
            { id: 'l1', title: 'A', isPreview: true },
            { id: 'l2', title: 'B', isPreview: false },
        ];

        it('should mark only preview lessons accessible for anonymous user', async () => {
            (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1', pathId: 'path-1' });
            (prisma.lesson.findMany as jest.Mock).mockResolvedValue(mockLessons);

            const result = await lessonService.listLessons('mod-1');

            expect(result).toEqual([
                { id: 'l1', title: 'A', isPreview: true, isAccessible: true },
                { id: 'l2', title: 'B', isPreview: false, isAccessible: false },
            ]);
            // Anonymous → no user lookup, no enrollment lookup
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
            expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
        });

        it('should mark all lessons accessible for enrolled user', async () => {
            (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1', pathId: 'path-1' });
            (prisma.lesson.findMany as jest.Mock).mockResolvedValue(mockLessons);
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'STUDENT' });
            (prisma.enrollment.findFirst as jest.Mock).mockResolvedValue({ id: 'enr-1' });

            const result = await lessonService.listLessons('mod-1', 'user-1');

            expect(result.every((l) => l.isAccessible)).toBe(true);
        });

        it('should mark only preview lessons accessible for non-enrolled user', async () => {
            (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1', pathId: 'path-1' });
            (prisma.lesson.findMany as jest.Mock).mockResolvedValue(mockLessons);
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'STUDENT' });
            (prisma.enrollment.findFirst as jest.Mock).mockResolvedValue(null);

            const result = await lessonService.listLessons('mod-1', 'user-1');

            expect(result[0].isAccessible).toBe(true);
            expect(result[1].isAccessible).toBe(false);
        });

        it('should mark all lessons accessible for admin without enrollment lookup', async () => {
            (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'mod-1', pathId: 'path-1' });
            (prisma.lesson.findMany as jest.Mock).mockResolvedValue(mockLessons);
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN' });

            const result = await lessonService.listLessons('mod-1', 'admin-1');

            expect(result.every((l) => l.isAccessible)).toBe(true);
            expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
        });

        it('should throw 404 if module not found', async () => {
            (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(lessonService.listLessons('bad')).rejects.toThrow(AppError);
        });
    });

    // ============================================================
    // getLessonById — access control
    // ============================================================
    describe('getLessonById', () => {
        const previewLesson = {
            id: 'l1',
            isPreview: true,
            isPublished: true,
            module: { id: 'mod-1', title: 'Module', pathId: 'path-1' },
            quizQuestions: [],
        };
        const lockedLesson = {
            id: 'l1',
            isPreview: false,
            isPublished: true,
            module: { id: 'mod-1', title: 'Module', pathId: 'path-1' },
            quizQuestions: [],
        };
        const lockStatusLesson = {
            id: 'l1',
            module: { lessons: [{ id: 'l1', order: 1, lockDurationHours: 12 }] },
        };

        it('should allow anonymous user to access a preview lesson', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(previewLesson);

            const result = await lessonService.getLessonById('l1');

            expect(result.access.reason).toBe('preview');
            expect(result.lockStatus).toBe(null);
            // Preview short-circuits → no user/enrollment lookups
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
            expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
        });

        it('should throw 403 for anonymous user on non-preview lesson', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(lockedLesson);

            await expect(lessonService.getLessonById('l1')).rejects.toThrow(AppError);
            await expect(lessonService.getLessonById('l1')).rejects.toThrow(
                'يجب الاشتراك في هذه الدورة للوصول إلى الدرس'
            );
        });

        it('should allow enrolled user to access non-preview lesson', async () => {
            (prisma.lesson.findUnique as jest.Mock)
                .mockResolvedValueOnce(lockedLesson) // access check
                .mockResolvedValueOnce(lockStatusLesson); // lock status fetch
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                role: 'STUDENT',
                parentId: null,
            });
            (prisma.enrollment.findFirst as jest.Mock).mockResolvedValue({ id: 'enr-1' });

            const result = await lessonService.getLessonById('l1', 'user-1');

            expect(result.access.reason).toBe('enrolled');
            expect(result.lockStatus).toBeDefined();
        });

        it('should allow admin to access non-preview lesson without enrollment', async () => {
            (prisma.lesson.findUnique as jest.Mock)
                .mockResolvedValueOnce(lockedLesson)
                .mockResolvedValueOnce(lockStatusLesson);
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                role: 'ADMIN',
                parentId: null,
            });

            const result = await lessonService.getLessonById('l1', 'admin-1');

            expect(result.access.reason).toBe('admin');
            expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
        });

        it('should throw 403 for authenticated non-enrolled user on non-preview lesson', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(lockedLesson);
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'STUDENT' });
            (prisma.enrollment.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(lessonService.getLessonById('l1', 'user-1')).rejects.toThrow(AppError);
        });

        it('should throw 404 if lesson not found or not published', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(lessonService.getLessonById('bad')).rejects.toThrow(AppError);
        });

        it('should throw 404 if lesson exists but is unpublished', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
                ...previewLesson,
                isPublished: false,
            });
            await expect(lessonService.getLessonById('l1')).rejects.toThrow(AppError);
        });
    });

    // ============================================================
    // updateLesson
    // ============================================================
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

    // ============================================================
    // deleteLesson
    // ============================================================
    describe('deleteLesson', () => {
        it('should delete lesson', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'l1' });
            (prisma.lesson.delete as jest.Mock).mockResolvedValue({ id: 'l1' });

            const result = await lessonService.deleteLesson('l1');
            expect(prisma.lesson.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
            expect(result).toEqual({ id: 'l1' });
        });

        it('should throw 404 if lesson not found', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(lessonService.deleteLesson('bad')).rejects.toThrow(AppError);
        });
    });

    // ============================================================
    // getLessonLockStatus
    // ============================================================
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
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
                id: 'l1',
                module: { lessons: [{ id: 'l1', order: 1, lockDurationHours: 12 }] },
            });
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
            const completedAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
            (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue({
                completed: true,
                completedAt,
                lastAccessedAt: completedAt,
            });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            const result = await lessonService.getLessonLockStatus('l2', 'user1');
            expect(result.isLocked).toBe(true);
            expect(result.remainingSeconds).toBeGreaterThan(0);
        });

        it('should unlock if lock duration passed', async () => {
            const completedAt = new Date(Date.now() - 13 * 60 * 60 * 1000);
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
            const completedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
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
            expect(result.isLocked).toBe(true);
            expect(result.remainingSeconds).toBeGreaterThan(0);
        });

        it('should return unlocked when parent sets custom duration to 0', async () => {
            const completedAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
            (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue({
                completed: true,
                completedAt,
                lastAccessedAt: completedAt,
            });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ parentId: 'parent-1' });
            (prisma.childSettings.findUnique as jest.Mock).mockResolvedValue({
                lockOverrideEnabled: true,
                customLockDurationHours: 0,
            });
            const result = await lessonService.getLessonLockStatus('l2', 'user1');
            expect(result.isLocked).toBe(false);
            expect(result.message).toContain('قفل معطل');
        });
    });
});