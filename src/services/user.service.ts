import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { redis } from '../config/redis';
import { config } from '../config/env';
import { User, Role, SkillLevel } from '@prisma/client';

// Helper: sanitize user object for API response
const sanitizeUser = (user: any) => ({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    displayName: user.displayName,
    bio: user.bio,
    country: user.country,
    language: user.language,
    learningGoal: user.learningGoal,
    skillLevel: user.skillLevel,
    isPublic: user.isPublic,
    profilePictureUrl: user.avatarUrl, // map avatarUrl to profilePictureUrl
    timezone: user.timezone,
    role: user.role.toLowerCase(), // we want lowercase in API
    emailVerified: user.isEmailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

// Get current user profile with gamification and progress summary
export const getMe = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            stats: true,
            enrollments: {
                include: {
                    path: {
                        select: { id: true, title: true, isPublished: true }, // added isPublished
                    },
                },
            },
            progress: {
                select: { lessonId: true, completed: true },
            },
        },
    });

    if (!user || user.deletedAt) {
        throw new AppError(404, 'المستخدم غير موجود');
    }

    // Gamification summary
    const gamification = {
        level: user.stats?.level ?? 1,
        xp: user.stats?.xp ?? 0,
        xpToNextLevel: 50, // later dynamic from level definitions
        streak: user.stats?.streak ?? 0,
        badges: [], // fetch badges separately if needed; for now empty
    };

    // Progress summary
    const totalPathsEnrolled = user.enrollments.length;
    // For now, we cannot accurately compute completed paths without more data; set to 0 and leave TODO
    const totalPathsCompleted = 0; // TODO: implement based on lesson completion
    const completedLessons = user.progress.filter(p => p.completed).length;
    const totalLessonsCompleted = completedLessons;
    const currentPath = user.enrollments.find(e => e.path && e.path.isPublished)?.path ?? null;

    return {
        user: sanitizeUser(user),
        gamification,
        progress: {
        totalPathsEnrolled,
        totalPathsCompleted,
        totalLessonsCompleted,
        currentPath,
        },
    };
};

// Update user profile (full or partial)
export const updateProfile = async (userId: string, data: any, partial = false) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
        throw new AppError(404, 'المستخدم غير موجود');
    }

    // Apply validation: for full update (PUT), we may require all fields; but we'll be lenient and update provided fields
    const updateData: any = {
        ...data,
    };

    // Convert displayName to optional null if provided null
    if (updateData.displayName === null) updateData.displayName = null;
    if (updateData.bio === null) updateData.bio = null;
    if (updateData.country === null) updateData.country = null;
    if (updateData.timezone === null) updateData.timezone = null;
    if (updateData.learningGoal === null) updateData.learningGoal = null;

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
        id: true,
        email: true,
        fullName: true,
        displayName: true,
        bio: true,
        country: true,
        language: true,
        learningGoal: true,
        skillLevel: true,
        isPublic: true,
        avatarUrl: true,
        timezone: true,
        role: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        },
    });

    return sanitizeUser(updatedUser);
};

// Soft delete user account
export const deleteMe = async (userId: string) => {
    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
        deletedAt: new Date(),
        isActive: false,
        },
    });
    return { success: true };
};

// Update privacy settings
export const updatePrivacy = async (userId: string, privacyData: any) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'المستخدم غير موجود');

    const currentPrivacy = (user.privacySettings as any) || {};
    const newPrivacy = {
        ...currentPrivacy,
        ...privacyData,
    };

    await prisma.user.update({
        where: { id: userId },
        data: { privacySettings: newPrivacy },
    });

    return { success: true, privacySettings: newPrivacy };
};

// Get privacy settings
export const getPrivacy = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { privacySettings: true },
    });
    return user?.privacySettings || {};
};

// Update avatar URL in DB
export const updateAvatar = async (userId: string, avatarPath: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'المستخدم غير موجود');

    const updated = await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: avatarPath },
        select: { id: true, avatarUrl: true },
    });
    return updated;
};

// Remove avatar (set null)
export const removeAvatar = async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'المستخدم غير موجود');

    const updated = await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
        select: { id: true, avatarUrl: true },
    });
    return updated;
};