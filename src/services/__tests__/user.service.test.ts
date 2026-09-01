import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as userService from '../user.service';

// Mock Prisma
jest.mock('../../config/database', () => ({
    prisma: {
        user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        },
    },
}));

describe('User Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getMe', () => {
        it('should return user with gamification and progress', async () => {
        const mockUser = {
            id: 'user-uuid',
            email: 'test@example.com',
            fullName: 'Test User',
            displayName: null,
            bio: null,
            country: 'EG',
            language: 'ar',
            learningGoal: null,
            skillLevel: 'BEGINNER',
            isPublic: true,
            avatarUrl: null,
            timezone: null,
            lastLoginAt: null,
            role: 'STUDENT',
            isEmailVerified: false,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            stats: { level: 2, xp: 150, streak: 3 },
            enrollments: [
            { course: { id: 'course-1', title: 'Python', isPublished: true } },
            ],
            progress: [
            { lessonId: 'lesson-1', completed: true },
            { lessonId: 'lesson-2', completed: false },
            ],
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

        const result = await userService.getMe('user-uuid');

        expect(result.user).toHaveProperty('id', 'user-uuid');
        expect(result.user).toHaveProperty('profilePictureUrl', null);
        expect(result.gamification.level).toBe(2);
        expect(result.progress.totalLessonsCompleted).toBe(1);
        expect(result.progress.currentCourse).toBeDefined();
        });

        it('should handle missing stats and empty arrays gracefully', async () => {
        const mockUser = {
            id: 'user-uuid',
            email: 'test@example.com',
            fullName: 'Test User',
            displayName: null,
            bio: null,
            country: 'EG',
            language: 'ar',
            learningGoal: null,
            skillLevel: 'BEGINNER',
            isPublic: true,
            avatarUrl: null,
            timezone: null,
            lastLoginAt: null,
            role: 'STUDENT',
            isEmailVerified: false,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            stats: null,
            enrollments: [],
            progress: [],
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

        const result = await userService.getMe('user-uuid');

        expect(result.gamification.level).toBe(1);
        expect(result.gamification.xp).toBe(0);
        expect(result.progress.totalCoursesEnrolled).toBe(0);
        expect(result.progress.currentCourse).toBeNull();
        });

        it('should throw 404 if user not found', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(userService.getMe('nonexistent')).rejects.toThrow(AppError);
        });

        it('should throw 404 if user is soft-deleted', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'x', deletedAt: new Date() });

        await expect(userService.getMe('x')).rejects.toThrow('المستخدم غير موجود');
        });
    });

    describe('updateProfile', () => {
        it('should update user and return sanitized user', async () => {
        const mockExisting = { id: 'user-uuid', deletedAt: null };
        const mockUpdated = {
            id: 'user-uuid',
            email: 'test@example.com',
            fullName: 'New Name',
            displayName: 'New Display',
            bio: 'New bio',
            country: 'EG',
            language: 'ar',
            learningGoal: 'developer',
            skillLevel: 'INTERMEDIATE',
            isPublic: false,
            avatarUrl: null,
            timezone: 'Africa/Cairo',
            role: 'STUDENT',
            isEmailVerified: true,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockExisting);
        (prisma.user.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await userService.updateProfile('user-uuid', {
            fullName: 'New Name',
            bio: 'New bio',
            displayName: 'New Display',
        });

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-uuid' },
            data: expect.objectContaining({ fullName: 'New Name' }),
            select: expect.any(Object),
        });
        expect(result).toHaveProperty('fullName', 'New Name');
        expect(result).toHaveProperty('profilePictureUrl', null);
        });

        it('should convert null fields correctly', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-uuid', deletedAt: null });
        (prisma.user.update as jest.Mock).mockResolvedValue({
            id: 'user-uuid',
            email: 'test@example.com',
            fullName: 'Test User',
            displayName: null,
            bio: null,
            country: null,
            language: 'ar',
            learningGoal: null,
            skillLevel: 'BEGINNER',
            isPublic: true,
            avatarUrl: null,
            timezone: null,
            role: 'STUDENT',          // <-- important for toLowerCase()
            isEmailVerified: false,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await userService.updateProfile('user-uuid', {
            displayName: null,
            bio: null,
            country: null,
            timezone: null,
            learningGoal: null,
        });

        const updateData = (prisma.user.update as jest.Mock).mock.calls[0][0].data;
        expect(updateData.displayName).toBeNull();
        expect(updateData.bio).toBeNull();
        expect(updateData.country).toBeNull();
        expect(updateData.timezone).toBeNull();
        expect(updateData.learningGoal).toBeNull();
        });

        it('should throw 404 if user not found or deleted', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(userService.updateProfile('bad-id', {})).rejects.toThrow(AppError);
        });
    });

    describe('deleteMe', () => {
        it('should soft delete user', async () => {
        (prisma.user.update as jest.Mock).mockResolvedValue({});

        const result = await userService.deleteMe('user-uuid');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-uuid' },
            data: { deletedAt: expect.any(Date), isActive: false },
        });
        expect(result.success).toBe(true);
        });
    });

    describe('updatePrivacy', () => {
        it('should merge privacy settings and update', async () => {
        const mockUser = {
            id: 'user-uuid',
            privacySettings: { profileVisibility: 'public' },
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (prisma.user.update as jest.Mock).mockResolvedValue({});

        const result = await userService.updatePrivacy('user-uuid', { showProgress: false });

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-uuid' },
            data: { privacySettings: { profileVisibility: 'public', showProgress: false } },
        });
        expect(result.success).toBe(true);
        expect(result.privacySettings).toEqual({ profileVisibility: 'public', showProgress: false });
        });

        it('should use empty object if no existing privacy settings', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-uuid', privacySettings: null });
        (prisma.user.update as jest.Mock).mockResolvedValue({});

        const result = await userService.updatePrivacy('user-uuid', { showProgress: true });

        expect(result.privacySettings).toEqual({ showProgress: true });
        });

        it('should throw 404 if user not found', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(userService.updatePrivacy('bad-id', {})).rejects.toThrow(AppError);
        });
    });

    describe('getPrivacy', () => {
        it('should return privacy settings', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ privacySettings: { profileVisibility: 'private' } });

        const result = await userService.getPrivacy('user-uuid');

        expect(result).toEqual({ profileVisibility: 'private' });
        });

        it('should return empty object if no settings', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        const result = await userService.getPrivacy('user-uuid');

        expect(result).toEqual({});
        });
    });

    describe('avatar functions', () => {
        it('should update avatar URL', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-uuid' });
        (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-uuid', avatarUrl: '/uploads/avatars/test.jpg' });

        const result = await userService.updateAvatar('user-uuid', '/uploads/avatars/test.jpg');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-uuid' },
            data: { avatarUrl: '/uploads/avatars/test.jpg' },
            select: { id: true, avatarUrl: true },
        });
        expect(result.avatarUrl).toBe('/uploads/avatars/test.jpg');
        });

        it('should throw 404 if user not found during avatar update', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(userService.updateAvatar('bad-id', 'path')).rejects.toThrow(AppError);
        });

        it('should remove avatar', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-uuid' });
        (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-uuid', avatarUrl: null });

        const result = await userService.removeAvatar('user-uuid');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-uuid' },
            data: { avatarUrl: null },
            select: { id: true, avatarUrl: true },
        });
        expect(result.avatarUrl).toBeNull();
        });

        it('should throw 404 if user not found during avatar removal', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(userService.removeAvatar('bad-id')).rejects.toThrow(AppError);
        });
    });
});