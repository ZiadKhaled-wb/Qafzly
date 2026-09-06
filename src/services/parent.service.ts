import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const addChild = async (parentUserId: string, childId: string) => {
    const parent = await prisma.user.findUnique({ where: { id: parentUserId } });
    if (!parent || parent.deletedAt || parent.role !== 'PARENT') {
        throw new AppError(403, 'غير مصرح لك بإضافة طفل');
    }

    const child = await prisma.user.findUnique({ where: { id: childId } });
    if (!child || child.deletedAt || child.role !== 'STUDENT') {
        throw new AppError(400, 'الطفل المحدد غير موجود أو ليس طالبًا');
    }

    if (child.parentId) {
        throw new AppError(400, 'هذا الطفل مرتبط بالفعل بمستخدم آخر');
    }

    return prisma.user.update({
        where: { id: childId },
        data: { parentId: parentUserId },
        select: { id: true, fullName: true, email: true, parentId: true },
    });
};

export const removeChild = async (parentUserId: string, childId: string) => {
    const child = await prisma.user.findFirst({
        where: { id: childId, parentId: parentUserId, deletedAt: null },
    });
    if (!child) throw new AppError(404, 'الطفل غير موجود أو غير مرتبط بك');

    await prisma.childSettings.deleteMany({
        where: { parentId: parentUserId, childId },
    });

    return prisma.user.update({
        where: { id: childId },
        data: { parentId: null },
    });
};

export const listChildren = async (parentUserId: string) => {
    return prisma.user.findMany({
        where: { parentId: parentUserId, deletedAt: null },
        select: {
        id: true,
        fullName: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        stats: true,
        },
        orderBy: { fullName: 'asc' },
    });
};

export const getChildProgress = async (parentUserId: string, childId: string) => {
    const child = await prisma.user.findFirst({
        where: { id: childId, parentId: parentUserId, deletedAt: null },
    });
    if (!child) throw new AppError(404, 'الطفل غير موجود');

    const progress = await prisma.lessonProgress.findMany({
        where: { userId: childId },
        include: {
        lesson: {
            select: {
            id: true,
            title: true,
            module: { select: { id: true, title: true, path: { select: { id: true, title: true } } } },
            },
        },
        },
        orderBy: { updatedAt: 'desc' },
    });

    // Aggregate per path/module
    const summary = {
        childId,
        totalLessonsCompleted: progress.filter(p => p.completed).length,
        totalTimeSpent: progress.reduce((sum, p) => sum + p.timeSpent, 0),
        progress,
    };
    return summary;
};

export const getChildPerformance = async (parentUserId: string, childId: string) => {
    const child = await prisma.user.findFirst({
        where: { id: childId, parentId: parentUserId, deletedAt: null },
    });
    if (!child) throw new AppError(404, 'الطفل غير موجود');

    const [quizScores, challenges] = await Promise.all([
        prisma.lessonProgress.findMany({
        where: { userId: childId, quizScore: { not: null } },
        select: { lessonId: true, quizScore: true, updatedAt: true, lesson: { select: { title: true } } },
        orderBy: { updatedAt: 'desc' },
        }),
        prisma.lessonProgress.findMany({
        where: { userId: childId, completed: true },
        select: { lessonId: true, completedAt: true, lesson: { select: { title: true, challengeType: true } } },
        orderBy: { completedAt: 'desc' },
        }),
    ]);

    return { quizScores, challenges };
};

export const getChildTimeTracking = async (parentUserId: string, childId: string) => {
    const child = await prisma.user.findFirst({
        where: { id: childId, parentId: parentUserId, deletedAt: null },
    });
    if (!child) throw new AppError(404, 'الطفل غير موجود');

    const timeData = await prisma.lessonProgress.findMany({
        where: { userId: childId },
        select: {
        lessonId: true,
        timeSpent: true,
        lastAccessedAt: true,
        lesson: { select: { title: true } },
        },
        orderBy: { lastAccessedAt: 'desc' },
    });

    return timeData;
};

export const getChildSettings = async (parentUserId: string, childId: string) => {
    const settings = await prisma.childSettings.findUnique({
        where: { parentId_childId: { parentId: parentUserId, childId } },
    });
    if (!settings) {
        return {
        lockOverrideEnabled: false,
        customLockDurationHours: null,
        };
    }
    return settings;
};

export const updateChildSettings = async (
        parentUserId: string,
        childId: string,
        data: { lockOverrideEnabled?: boolean; customLockDurationHours?: number | null }
    ) => {
    const child = await prisma.user.findFirst({
        where: { id: childId, parentId: parentUserId, deletedAt: null },
    });
    if (!child) throw new AppError(404, 'الطفل غير موجود');

    return prisma.childSettings.upsert({
        where: { parentId_childId: { parentId: parentUserId, childId } },
        update: data,
        create: {
        parentId: parentUserId,
        childId,
        ...data,
        },
    });
};

export const getParentOverview = async (parentUserId: string) => {
    const children = await prisma.user.findMany({
        where: { parentId: parentUserId, deletedAt: null },
        select: {
        id: true,
        fullName: true,
        displayName: true,
        stats: {
            select: { xp: true, level: true, updatedAt: true },
        },
        createdAt: true,
        },
        orderBy: { fullName: 'asc' },
    });

    const totalChildren = children.length;
    const totalXP = children.reduce((sum, child) => sum + (child.stats?.xp ?? 0), 0);
    const lastActiveChild = [...children].sort((a, b) => {
        const dateA = a.stats?.updatedAt ?? a.createdAt;
        const dateB = b.stats?.updatedAt ?? b.createdAt;
        return dateB.getTime() - dateA.getTime();
    })[0];

    return {
        totalChildren,
        totalXP,
        children,
        lastActiveChild: lastActiveChild
        ? { id: lastActiveChild.id, fullName: lastActiveChild.fullName }
        : null,
    };
};

export const getBilling = async (parentUserId: string) => {
    const subscriptions = await prisma.subscription.findMany({
        where: { userId: parentUserId },
        orderBy: { startDate: 'desc' },
    });
    const purchases = await prisma.purchase.findMany({
        where: { userId: parentUserId },
        orderBy: { createdAt: 'desc' },
    });
    return { subscriptions, purchases };
};