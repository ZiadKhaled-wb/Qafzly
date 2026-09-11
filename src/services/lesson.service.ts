import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { extractYouTubeId } from '../utils/youtube';

// -------------------------------
// Access Control
// -------------------------------

type AccessReason = 'preview' | 'enrolled' | 'admin' | 'denied';

interface LessonAccess {
    canAccess: boolean;
    reason: AccessReason;
}

/**
 * Decides whether a user can access a lesson's content.
 *
 * Rules (in priority order):
 *   1. Preview lessons are open to everyone (including anonymous).
 *   2. Admins bypass all enrollment checks.
 *   3. Authenticated users with an active enrollment in the parent path get access.
 *   4. Otherwise → denied.
 */
const determineLessonAccess = async (
    userId: string | undefined,
    pathId: string,
    isPreview: boolean
): Promise<LessonAccess> => {
    if (isPreview) {
        return { canAccess: true, reason: 'preview' };
    }

    if (!userId) {
        return { canAccess: false, reason: 'denied' };
    }

    // Admin check
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    if (user?.role === 'ADMIN') {
        return { canAccess: true, reason: 'admin' };
    }

    // Active enrollment check
    const enrollment = await prisma.enrollment.findFirst({
        where: { userId, pathId, isActive: true },
        select: { id: true },
    });
    if (enrollment) {
        return { canAccess: true, reason: 'enrolled' };
    }

    return { canAccess: false, reason: 'denied' };
};

// -------------------------------
// Lesson CRUD
// -------------------------------

export const listLessons = async (moduleId: string, userId?: string) => {
    const module = await prisma.module.findUnique({
        where: { id: moduleId },
        select: { id: true, pathId: true },
    });
    if (!module) throw new AppError(404, 'الوحدة غير موجودة');

    const lessons = await prisma.lesson.findMany({
        where: { moduleId, isPublished: true },
        orderBy: { order: 'asc' },
        select: {
            id: true,
            title: true,
            titleEn: true,
            contentType: true,
            videoUrl: true,
            isPreview: true,
            estimatedTime: true,
            order: true,
            overviewVideoUrl: true,
            pdfUrl: true,
            explanatoryVideoUrl: true,
            challengeType: true,
            lockDurationHours: true,
        },
    });

    // Compute path-level access once (avoids N+1)
    let enrolledInPath = false;
    let isAdmin = false;

    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
        isAdmin = user?.role === 'ADMIN';

        if (!isAdmin) {
            const enrollment = await prisma.enrollment.findFirst({
                where: { userId, pathId: module.pathId, isActive: true },
                select: { id: true },
            });
            enrolledInPath = !!enrollment;
        }
    }

    return lessons.map((lesson) => ({
        ...lesson,
        isAccessible: lesson.isPreview || enrolledInPath || isAdmin,
    }));
};

export const getLessonById = async (id: string, userId?: string) => {
    const lesson = await prisma.lesson.findUnique({
        where: { id },
        include: {
            quizQuestions: true,
            module: {
                select: {
                    id: true,
                    title: true,
                    pathId: true,
                },
            },
        },
    });
    if (!lesson || !lesson.isPublished) throw new AppError(404, 'الدرس غير موجود');

    // Access control
    const access = await determineLessonAccess(userId, lesson.module.pathId, lesson.isPreview);
    if (!access.canAccess) {
        throw new AppError(403, 'يجب الاشتراك في هذه الدورة للوصول إلى الدرس');
    }

    // Lock status is only meaningful for authenticated users
    let lockStatus = null;
    if (userId) {
        lockStatus = await getLessonLockStatus(id, userId);
    }

    return {
        ...lesson,
        lockStatus,
        access: { reason: access.reason },
    };
};

export const createLesson = async (data: any) => {
    const module = await prisma.module.findUnique({ where: { id: data.moduleId } });
    if (!module) throw new AppError(404, 'الوحدة غير موجودة');

    return prisma.lesson.create({
        data: {
            moduleId: data.moduleId,
            title: data.title,
            titleEn: data.titleEn,
            content: data.content,
            contentEn: data.contentEn,
            contentType: data.contentType || 'TEXT',
            videoUrl: data.videoUrl,
            videoDuration: data.videoDuration,
            hasQuiz: data.hasQuiz,
            order: data.order,
            isPreview: data.isPreview,
            isPublished: data.isPublished,
            estimatedTime: data.estimatedTime,
            overviewVideoUrl: data.overviewVideoUrl ? extractYouTubeId(data.overviewVideoUrl) : null,
            explanatoryVideoUrl: data.explanatoryVideoUrl ? extractYouTubeId(data.explanatoryVideoUrl) : null,
            pdfUrl: data.pdfUrl,
            slidesJson: data.slidesJson,
            challengeDescription: data.challengeDescription,
            challengeType: data.challengeType || 'quiz',
            challengeData: data.challengeData,
            lockDurationHours: data.lockDurationHours ?? 12,
        },
    });
};

export const updateLesson = async (id: string, data: any) => {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    return prisma.lesson.update({
        where: { id },
        data: {
            ...data,
        },
    });
};

export const deleteLesson = async (id: string) => {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    return prisma.lesson.delete({ where: { id } });
};

// -------------------------------
// Lock Logic
// -------------------------------

export const getLessonLockStatus = async (lessonId: string, userId: string) => {
    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { module: { include: { lessons: { orderBy: { order: 'asc' } } } } },
    });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    // If it's the first lesson in the module, no lock
    const lessons = lesson.module.lessons;
    const lessonIndex = lessons.findIndex((l) => l.id === lessonId);
    if (lessonIndex <= 0) {
        return { isLocked: false, remainingSeconds: 0, message: 'الدرس متاح' };
    }

    const previousLesson = lessons[lessonIndex - 1];

    // Check previous lesson completion
    const prevProgress = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: previousLesson.id } },
    });

    if (!prevProgress || !prevProgress.completed) {
        return { isLocked: true, remainingSeconds: null, message: 'يجب إكمال الدرس السابق أولاً' };
    }

    // Lock duration is defined by the *previous* lesson
    let lockDuration = previousLesson.lockDurationHours;

    // Fetch parent settings if user has a parent
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { parentId: true },
    });

    if (user?.parentId) {
        const settings = await prisma.childSettings.findUnique({
            where: { parentId_childId: { parentId: user.parentId, childId: userId } },
        });
        if (settings?.lockOverrideEnabled) {
            lockDuration = settings.customLockDurationHours ?? 0; // 0 means no lock
        }
    }

    if (lockDuration === 0) {
        return { isLocked: false, remainingSeconds: 0, message: 'قفل معطل من قبل ولي الأمر' };
    }

    const completedAt = prevProgress.completedAt ?? prevProgress.lastAccessedAt ?? new Date();
    const unlockTime = new Date(completedAt.getTime() + lockDuration * 60 * 60 * 1000);
    const now = new Date();
    const remainingMs = unlockTime.getTime() - now.getTime();

    if (remainingMs > 0) {
        return { isLocked: true, remainingSeconds: Math.ceil(remainingMs / 1000), message: 'الدرس مقفل مؤقتًا' };
    }

    return { isLocked: false, remainingSeconds: 0, message: 'الدرس متاح' };
};