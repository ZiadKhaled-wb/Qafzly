import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as progressService from '../progress.service';

jest.mock('../../config/database', () => ({
    prisma: {
        lesson: {
            findUnique: jest.fn(),
        },
        path: {
            findUnique: jest.fn(),
        },
        lessonProgress: {
            findUnique: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        },
        module: {
            findMany: jest.fn(),
        },
    },
}));

describe('Progress Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('updateLessonProgress', () => {
        const mockLesson = { id: 'lesson-1' };

        it('should create progress if not exists', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
            (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue(null);
            const mockCreated = {
                id: 'prog-1',
                userId: 'user-1',
                lessonId: 'lesson-1',
                completed: true,
                completedAt: new Date(),
                timeSpent: 60,
                quizScore: 80,
            };
            (prisma.lessonProgress.create as jest.Mock).mockResolvedValue(mockCreated);

            const result = await progressService.updateLessonProgress('user-1', 'lesson-1', {
                completed: true,
                timeSpent: 60,
                quizScore: 80,
            });

            expect(prisma.lessonProgress.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-1',
                    lessonId: 'lesson-1',
                    completed: true,
                    completedAt: expect.any(Date),
                    timeSpent: 60,
                    quizScore: 80,
                },
            });
            expect(result).toEqual(mockCreated);
        });

        it('should update existing progress', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);
            const existing = {
                id: 'prog-1',
                userId: 'user-1',
                lessonId: 'lesson-1',
                completed: false,
                completedAt: null,
                timeSpent: 30,
                quizScore: null,
            };
            (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue(existing);
            const mockUpdated = {
                ...existing,
                completed: true,
                completedAt: new Date(),
                timeSpent: 60,
                quizScore: 80,
                lastAccessedAt: new Date(),
            };
            (prisma.lessonProgress.update as jest.Mock).mockResolvedValue(mockUpdated);

            const result = await progressService.updateLessonProgress('user-1', 'lesson-1', {
                completed: true,
                timeSpent: 60,
                quizScore: 80,
            });

            expect(prisma.lessonProgress.update).toHaveBeenCalledWith({
                where: { id: 'prog-1' },
                data: {
                    completed: true,
                    completedAt: expect.any(Date),
                    timeSpent: 60,
                    quizScore: 80,
                    lastAccessedAt: expect.any(Date),
                },
            });
            expect(result).toEqual(mockUpdated);
        });

        it('should throw 404 if lesson not found', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(
                progressService.updateLessonProgress('user-1', 'bad-lesson', { completed: true })
            ).rejects.toThrow(AppError);
        });
    });

    describe('getPathProgress', () => {
        it('should return progress summary for a path', async () => {
            const mockPath = { id: 'path-1' };
            (prisma.path.findUnique as jest.Mock).mockResolvedValue(mockPath);

            const mockModules = [
                {
                    id: 'mod-1',
                    title: 'Module 1',
                    order: 1,
                    lessons: [
                        {
                            id: 'lesson-1',
                            title: 'Lesson 1',
                            order: 1,
                            progress: [{ completed: true, completedAt: new Date(), timeSpent: 120, quizScore: 90 }],
                        },
                        {
                            id: 'lesson-2',
                            title: 'Lesson 2',
                            order: 2,
                            progress: [],
                        },
                    ],
                },
                {
                    id: 'mod-2',
                    title: 'Module 2',
                    order: 2,
                    lessons: [
                        {
                            id: 'lesson-3',
                            title: 'Lesson 3',
                            order: 1,
                            progress: [{ completed: false, completedAt: null, timeSpent: 30, quizScore: null }],
                        },
                    ],
                },
            ];
            (prisma.module.findMany as jest.Mock).mockResolvedValue(mockModules);

            const result = await progressService.getPathProgress('user-1', 'path-1');

            expect(prisma.module.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { pathId: 'path-1', isPublished: true },
                })
            );
            expect(result.totalLessons).toBe(3);
            expect(result.completedLessons).toBe(1);
            expect(result.progressPercent).toBe(33);
            expect(result.modules).toHaveLength(2);
        });

        it('should throw 404 if path not found', async () => {
            (prisma.path.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(progressService.getPathProgress('user-1', 'bad-path')).rejects.toThrow(AppError);
        });
    });
});