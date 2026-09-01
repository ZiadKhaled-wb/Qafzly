import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { ForumPostStatus, ForumCommentStatus } from '@prisma/client';

export const listReports = async (params: any) => {
    const { page, limit, status } = params;
    const where: any = { flaggedCount: { gt: 0 } };
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
        prisma.forumPost.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { flaggedCount: 'desc' },
        select: {
            id: true,
            title: true,
            content: true,
            status: true,
            flaggedCount: true,
            createdAt: true,
            user: { select: { id: true, fullName: true, email: true } },
        },
        }),
        prisma.forumPost.count({ where }),
    ]);

    return {
        reports,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};

export const resolveReport = async (reportId: string, adminId: string) => {
    const post = await prisma.forumPost.findUnique({ where: { id: reportId } });
    if (!post) throw new AppError(404, 'المنشور غير موجود');

    await prisma.forumPost.update({
        where: { id: reportId },
        data: { flaggedCount: 0 },
    });
    return { success: true };
};

export const hidePost = async (postId: string) => {
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, 'المنشور غير موجود');
    await prisma.forumPost.update({
        where: { id: postId },
        data: { status: ForumPostStatus.hidden },
    });
    return { success: true };
};

export const unhidePost = async (postId: string) => {
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, 'المنشور غير موجود');
    await prisma.forumPost.update({
        where: { id: postId },
        data: { status: ForumPostStatus.published },
    });
    return { success: true };
};

export const hideComment = async (commentId: string) => {
    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new AppError(404, 'التعليق غير موجود');
    await prisma.forumComment.update({
        where: { id: commentId },
        data: { status: ForumCommentStatus.hidden },
    });
    return { success: true };
};

export const unhideComment = async (commentId: string) => {
    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new AppError(404, 'التعليق غير موجود');
    await prisma.forumComment.update({
        where: { id: commentId },
        data: { status: ForumCommentStatus.published },
    });
    return { success: true };
};