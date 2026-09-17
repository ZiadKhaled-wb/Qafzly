import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

interface AddChildIdentifier {
    childId?: string;
    email?: string;
}

/**
 * Link a STUDENT user to a PARENT.
 *
 * Accepts either `childId` (uuid) or `email`. Exactly one must be provided —
 * the Zod schema enforces this, but the service defensively checks too.
 *
 * Error responses (documented in the frontend reference sheet):
 *   403 — caller is not a PARENT
 *   404 — child not found (by id or email)
 *   400 — target user is not a STUDENT
 *   400 — caller tried to link themselves
 *   409 — target child is already linked to another parent
 */
export const addChild = async (
    parentUserId: string,
    identifier: AddChildIdentifier
) => {
    const parent = await prisma.user.findUnique({ where: { id: parentUserId } });
    if (!parent || parent.deletedAt || parent.role !== 'PARENT') {
        throw new AppError(403, 'غير مصرح لك بإضافة طفل');
    }

    if (!identifier.childId && !identifier.email) {
        throw new AppError(400, 'يجب تقديم childId أو email');
    }
    if (identifier.childId && identifier.email) {
        throw new AppError(400, 'قدم واحداً فقط من childId أو email');
    }

    // Resolve the child — by id or by email
    let child;
    if (identifier.childId) {
        child = await prisma.user.findUnique({ where: { id: identifier.childId } });
    } else {
        child = await prisma.user.findUnique({ where: { email: identifier.email! } });
        if (!child) {
            throw new AppError(404, 'لا يوجد مستخدم بهذا البريد الإلكتروني');
        }
    }

    if (!child || child.deletedAt) {
        throw new AppError(404, 'المستخدم غير موجود');
    }
    if (child.id === parentUserId) {
        throw new AppError(400, 'لا يمكنك ربط نفسك');
    }
    if (child.role !== 'STUDENT') {
        throw new AppError(400, 'المستخدم المحدد ليس طالبًا');
    }
    if (child.parentId) {
        throw new AppError(409, 'هذا الطفل مرتبط بالفعل بمستخدم آخر');
    }

    return prisma.user.update({
        where: { id: child.id },
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
                    module: {
                        select: {
                            id: true,
                            title: true,
                            path: { select: { id: true, title: true } },
                        },
                    },
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    return {
        childId,
        totalLessonsCompleted: progress.filter((p) => p.completed).length,
        totalTimeSpent: progress.reduce((sum, p) => sum + p.timeSpent, 0),
        progress,
    };
};

export const getChildPerformance = async (parentUserId: string, childId: string) => {
    const child = await prisma.user.findFirst({
        where: { id: childId, parentId: parentUserId, deletedAt: null },
    });
    if (!child) throw new AppError(404, 'الطفل غير موجود');

    const [quizScores, challenges] = await Promise.all([
        prisma.lessonProgress.findMany({
            where: { userId: childId, quizScore: { not: null } },
            select: {
                lessonId: true,
                quizScore: true,
                updatedAt: true,
                lesson: { select: { title: true } },
            },
            orderBy: { updatedAt: 'desc' },
        }),
        prisma.lessonProgress.findMany({
            where: { userId: childId, completed: true },
            select: {
                lessonId: true,
                completedAt: true,
                lesson: { select: { title: true, challengeType: true } },
            },
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

    return prisma.lessonProgress.findMany({
        where: { userId: childId },
        select: {
            lessonId: true,
            timeSpent: true,
            lastAccessedAt: true,
            lesson: { select: { title: true } },
        },
        orderBy: { lastAccessedAt: 'desc' },
    });
};

/**
 * Get settings for a linked child.
 *
 * Returns a consistent flat shape whether or not a ChildSettings row exists:
 *   { lockOverrideEnabled: boolean, customLockDurationHours: number | null }
 *
 * Previously returned the full ChildSettings record when a row existed, and a
 * slimmer shape when it didn't — an inconsistency that broke the frontend.
 */
export const getChildSettings = async (parentUserId: string, childId: string) => {
    const settings = await prisma.childSettings.findUnique({
        where: { parentId_childId: { parentId: parentUserId, childId } },
        select: {
            lockOverrideEnabled: true,
            customLockDurationHours: true,
        },
    });

    return (
        settings ?? {
            lockOverrideEnabled: false,
            customLockDurationHours: null,
        }
    );
};

/**
 * Update settings for a linked child. Response uses the same flat shape as
 * getChildSettings — see the note there.
 */
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
        select: {
            lockOverrideEnabled: true,
            customLockDurationHours: true,
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

/**
 * Billing view for a parent: all purchases made BY the parent or BY any of
 * their linked children.
 *
 * The Subscription model has been deprecated — purchases are the source of
 * truth. Each purchase includes the paying user (so the UI can show
 * "paid by ..." for a child's purchase) and the path being purchased.
 */
export const getBilling = async (parentUserId: string) => {
    const children = await prisma.user.findMany({
        where: { parentId: parentUserId, deletedAt: null },
        select: { id: true },
    });

    const userIds = [parentUserId, ...children.map((c) => c.id)];

    const purchases = await prisma.purchase.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { id: true, fullName: true, email: true } },
            path: { select: { id: true, title: true, titleEn: true } },
        },
    });

    return { purchases };
};