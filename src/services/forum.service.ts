import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { ForumPost, ForumComment, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------
const getPaginationMeta = (page: number, limit: number, total: number) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
});

// ---------------------------------------------------------------------------
// Response shape helpers
// ---------------------------------------------------------------------------

interface AuthorShape {
    id: string;
    fullName: string;
    displayName: string | null;
    avatarUrl: string | null;
}

const toAuthor = (user: any): AuthorShape => ({
    id: user.id,
    fullName: user.fullName,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
});

const toPostResponse = (post: any, userVote: 'up' | 'down' | null = null) => {
    const { user, ...rest } = post;
    return {
        ...rest,
        author: user ? toAuthor(user) : null,
        userVote,
    };
};

const toCommentResponse = (
    comment: any,
    userVote: 'up' | 'down' | null = null,
    nestedReplies: any[] = []
) => {
    const { user, replies, ...rest } = comment;
    return {
        ...rest,
        author: user ? toAuthor(user) : null,
        userVote,
        replies: nestedReplies,
    };
};

// ---------------------------------------------------------------------------
// Batched vote lookup
// ---------------------------------------------------------------------------
const getUserVoteMap = async (
    userId: string | undefined,
    targetType: 'post' | 'comment',
    targetIds: string[]
): Promise<Map<string, 'up' | 'down'>> => {
    if (!userId || targetIds.length === 0) return new Map();

    const votes = await prisma.forumVote.findMany({
        where: {
            userId,
            targetType,
            targetId: { in: targetIds },
        },
        select: { targetId: true, voteType: true },
    });

    const map = new Map<string, 'up' | 'down'>();
    for (const v of votes) {
        map.set(v.targetId, v.voteType === 1 ? 'up' : 'down');
    }
    return map;
};

// ---------------------------------------------------------------------------
// Forum Categories
// ---------------------------------------------------------------------------

export const listCategories = async (params: any) => {
    const { page, limit, search, isActive } = params;
    const where: any = {};

    if (search) {
        where.OR = [
            { nameAr: { contains: search, mode: 'insensitive' } },
            { nameEn: { contains: search, mode: 'insensitive' } },
        ];
    }

    // Default to active-only. Pass ?isActive=false to fetch inactive.
    where.isActive = isActive !== undefined ? isActive : true;

    const [categories, total] = await Promise.all([
        prisma.forumCategory.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { displayOrder: 'asc' },
            include: {
                _count: {
                    select: {
                        posts: {
                            where: { deletedAt: null, status: 'published' },
                        },
                    },
                },
            },
        }),
        prisma.forumCategory.count({ where }),
    ]);

    const shaped = categories.map(({ _count, ...rest }: any) => ({
        ...rest,
        postCount: _count.posts,
    }));

    return { categories: shaped, ...getPaginationMeta(page, limit, total) };
};

// ---------------------------------------------------------------------------
// Forum Posts
// ---------------------------------------------------------------------------

export const createPost = async (userId: string, data: any) => {
    const { title, content, categoryId, pathId, lessonId } = data;
    const post = await prisma.forumPost.create({
        data: { userId, title, content, categoryId, pathId, lessonId },
    });

    const withRelations = await prisma.forumPost.findUnique({
        where: { id: post.id },
        include: {
            user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
            category: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
        },
    });

    return toPostResponse(withRelations, null);
};

export const getPostById = async (postId: string, userId?: string, isAdmin?: boolean) => {
    const post = await prisma.forumPost.findUnique({
        where: { id: postId },
        include: {
            user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
            category: true,
            path: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
        },
    });

    if (!post) throw new AppError(404, 'المنشور غير موجود');
    if (post.deletedAt && !isAdmin) throw new AppError(404, 'المنشور غير موجود');
    if (post.status === 'hidden' && !isAdmin && post.userId !== userId) {
        throw new AppError(404, 'المنشور غير موجود');
    }

    // Increment view count (fire-and-forget)
    prisma.forumPost
        .update({ where: { id: postId }, data: { viewCount: { increment: 1 } } })
        .catch(() => {});

    const voteMap = await getUserVoteMap(userId, 'post', [post.id]);
    return toPostResponse(post, voteMap.get(post.id) ?? null);
};

export const listPosts = async (params: any, currentUserId?: string) => {
    const { page, limit, categoryId, pathId, lessonId, status, search } = params;
    const sortBy = params.sortBy || 'createdAt';
    const order = params.order || 'desc';
    const where: any = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    if (pathId) where.pathId = pathId;
    if (lessonId) where.lessonId = lessonId;
    if (status) where.status = status;
    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
        ];
    }

    // Sort with deterministic tie-breaker on createdAt (desc)
    const orderBy: any[] = [];
    if (sortBy === 'upvotes') orderBy.push({ upvotes: order });
    else if (sortBy === 'viewCount') orderBy.push({ viewCount: order });
    else orderBy.push({ createdAt: order });
    orderBy.push({ createdAt: 'desc' });

    const [posts, total] = await Promise.all([
        prisma.forumPost.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy,
            include: {
                user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
                category: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
            },
        }),
        prisma.forumPost.count({ where }),
    ]);

    const voteMap = await getUserVoteMap(
        currentUserId,
        'post',
        posts.map((p) => p.id)
    );

    const shaped = posts.map((p) => toPostResponse(p, voteMap.get(p.id) ?? null));
    return { posts: shaped, ...getPaginationMeta(page, limit, total) };
};

export const updatePost = async (
    postId: string,
    userId: string,
    data: any,
    isAdmin: boolean = false
) => {
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new AppError(404, 'المنشور غير موجود');
    if (post.userId !== userId && !isAdmin) {
        throw new AppError(403, 'غير مصرح لك بتعديل هذا المنشور');
    }

    const updated = await prisma.forumPost.update({
        where: { id: postId },
        data: { ...data, updatedAt: new Date() },
        include: {
            user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
            category: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
        },
    });

    return toPostResponse(updated, null);
};

export const deletePost = async (postId: string, userId: string, isAdmin: boolean = false) => {
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new AppError(404, 'المنشور غير موجود');
    if (post.userId !== userId && !isAdmin) {
        throw new AppError(403, 'غير مصرح لك بحذف هذا المنشور');
    }

    await prisma.forumPost.update({
        where: { id: postId },
        data: { deletedAt: new Date(), status: 'deleted' },
    });
};

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const addComment = async (postId: string, userId: string, data: any) => {
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new AppError(404, 'المنشور غير موجود');
    if (post.isLocked) throw new AppError(422, 'المنشور مغلق ولا يمكن إضافة تعليقات');

    const comment = await prisma.forumComment.create({
        data: {
            postId,
            userId,
            content: data.content,
            parentCommentId: data.parentCommentId,
        },
        include: {
            user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
        },
    });

    await prisma.forumPost.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
    });

    return toCommentResponse(comment, null, []);
};

export const getComments = async (
    postId: string,
    params: any,
    currentUserId?: string
) => {
    const { page, limit } = params;

    // FIX: top-level filter must include `parentCommentId: null`, otherwise
    // replies appear both nested AND as standalone comments.
    const where: any = {
        postId,
        parentCommentId: null,
        deletedAt: null,
        status: 'published',
    };

    const [comments, total] = await Promise.all([
        prisma.forumComment.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'asc' },
            include: {
                user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
                replies: {
                    where: { deletedAt: null, status: 'published' },
                    orderBy: { createdAt: 'asc' },
                    include: {
                        user: {
                            select: { id: true, fullName: true, displayName: true, avatarUrl: true },
                        },
                    },
                },
            },
        }),
        prisma.forumComment.count({ where }),
    ]);

    const allIds: string[] = [];
    for (const c of comments) {
        allIds.push(c.id);
        for (const r of (c as any).replies) {
            allIds.push(r.id);
        }
    }
    const voteMap = await getUserVoteMap(currentUserId, 'comment', allIds);

    const shaped = comments.map((c: any) => {
        const nestedReplies = c.replies.map((r: any) =>
            toCommentResponse(r, voteMap.get(r.id) ?? null, [])
        );
        return toCommentResponse(c, voteMap.get(c.id) ?? null, nestedReplies);
    });

    return { comments: shaped, ...getPaginationMeta(page, limit, total) };
};

export const updateComment = async (
    commentId: string,
    userId: string,
    data: any,
    isAdmin: boolean = false
) => {
    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new AppError(404, 'التعليق غير موجود');
    if (comment.userId !== userId && !isAdmin) {
        throw new AppError(403, 'غير مصرح لك بتعديل هذا التعليق');
    }

    const updated = await prisma.forumComment.update({
        where: { id: commentId },
        data: { content: data.content, isEdited: true },
        include: {
            user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
        },
    });

    return toCommentResponse(updated, null, []);
};

export const deleteComment = async (
    commentId: string,
    userId: string,
    isAdmin: boolean = false
) => {
    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new AppError(404, 'التعليق غير موجود');
    if (comment.userId !== userId && !isAdmin) {
        throw new AppError(403, 'غير مصرح لك بحذف هذا التعليق');
    }

    await prisma.forumComment.update({
        where: { id: commentId },
        data: { deletedAt: new Date(), status: 'deleted' },
    });

    await prisma.forumPost.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
    });
};

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

export const vote = async (
    targetType: 'post' | 'comment',
    targetId: string,
    userId: string,
    voteType: 1 | -1
) => {
    if (targetType === 'post') {
        const post = await prisma.forumPost.findUnique({ where: { id: targetId } });
        if (!post || post.deletedAt) throw new AppError(404, 'المنشور غير موجود');
    } else {
        const comment = await prisma.forumComment.findUnique({ where: { id: targetId } });
        if (!comment || comment.deletedAt) throw new AppError(404, 'التعليق غير موجود');
    }

    const existing = await prisma.forumVote.findUnique({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });

    if (existing) {
        if (existing.voteType === voteType) {
            // Toggle off
            await prisma.forumVote.delete({ where: { id: existing.id } });
            const decrement =
                voteType === 1
                    ? { upvotes: { increment: -1 } }
                    : { downvotes: { increment: -1 } };
            if (targetType === 'post') {
                await prisma.forumPost.update({ where: { id: targetId }, data: decrement });
            } else {
                await prisma.forumComment.update({ where: { id: targetId }, data: decrement });
            }
        } else {
            // Change vote
            await prisma.forumVote.update({ where: { id: existing.id }, data: { voteType } });
            const data: any = {};
            if (existing.voteType === 1) data.upvotes = { increment: -1 };
            else data.downvotes = { increment: -1 };
            if (voteType === 1) data.upvotes = { increment: 1 };
            else data.downvotes = { increment: 1 };
            if (targetType === 'post') {
                await prisma.forumPost.update({ where: { id: targetId }, data });
            } else {
                await prisma.forumComment.update({ where: { id: targetId }, data });
            }
        }
    } else {
        // Create new vote
        await prisma.forumVote.create({ data: { userId, targetType, targetId, voteType } });
        const increment =
            voteType === 1 ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } };
        if (targetType === 'post') {
            await prisma.forumPost.update({ where: { id: targetId }, data: increment });
        } else {
            await prisma.forumComment.update({ where: { id: targetId }, data: increment });
        }
    }
};

// ---------------------------------------------------------------------------
// Best Answer
// ---------------------------------------------------------------------------

export const markBestAnswer = async (postId: string, commentId: string, userId: string) => {
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, 'المنشور غير موجود');
    if (post.userId !== userId) {
        throw new AppError(403, 'فقط صاحب المنشور يمكنه تحديد أفضل إجابة');
    }

    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.postId !== postId) {
        throw new AppError(404, 'التعليق غير موجود في هذا المنشور');
    }

    await prisma.forumComment.updateMany({
        where: { postId, isBestAnswer: true },
        data: { isBestAnswer: false },
    });
    await prisma.forumComment.update({
        where: { id: commentId },
        data: { isBestAnswer: true },
    });
    const updated = await prisma.forumPost.update({
        where: { id: postId },
        data: { isSolved: true },
        include: {
            user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
            category: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
        },
    });

    return toPostResponse(updated, null);
};

// ---------------------------------------------------------------------------
// Search (in-forum, simple ILIKE)
// ---------------------------------------------------------------------------

export const searchPosts = async (
    query: string,
    params: any,
    currentUserId?: string
) => {
    const { page, limit } = params;
    const where: any = {
        deletedAt: null,
        status: 'published',
        OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
        ],
    };

    const [posts, total] = await Promise.all([
        prisma.forumPost.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, fullName: true, displayName: true, avatarUrl: true } },
                category: { select: { id: true, nameAr: true, nameEn: true, slug: true } },
            },
        }),
        prisma.forumPost.count({ where }),
    ]);

    const voteMap = await getUserVoteMap(
        currentUserId,
        'post',
        posts.map((p) => p.id)
    );

    const shaped = posts.map((p) => toPostResponse(p, voteMap.get(p.id) ?? null));
    return { posts: shaped, ...getPaginationMeta(page, limit, total) };
};

// ---------------------------------------------------------------------------
// Reporting — Sprint 12
// ---------------------------------------------------------------------------

const REPORT_REASONS = [
    'spam',
    'harassment',
    'inappropriate',
    'misinformation',
    'off-topic',
    'other',
];

export const reportPost = async (
    postId: string,
    reporterId: string,
    reason: string,
    details?: string
) => {
    if (!REPORT_REASONS.includes(reason)) {
        throw new AppError(400, 'سبب الإبلاغ غير صالح');
    }

    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new AppError(404, 'المنشور غير موجود');
    if (post.userId === reporterId) {
        throw new AppError(400, 'لا يمكنك الإبلاغ عن منشورك الخاص');
    }

    const existing = await prisma.forumReport.findFirst({
        where: { reporterId, postId, status: 'pending' },
    });
    if (existing) throw new AppError(409, 'لقد قمت بالإبلاغ عن هذا المنشور بالفعل');

    // Create the report and bump the denormalized counter atomically.
    const [report] = await prisma.$transaction([
        prisma.forumReport.create({
            data: { postId, reporterId, reason, details },
        }),
        prisma.forumPost.update({
            where: { id: postId },
            data: { flaggedCount: { increment: 1 } },
        }),
    ]);

    return report;
};

export const reportComment = async (
    commentId: string,
    reporterId: string,
    reason: string,
    details?: string
) => {
    if (!REPORT_REASONS.includes(reason)) {
        throw new AppError(400, 'سبب الإبلاغ غير صالح');
    }

    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw new AppError(404, 'التعليق غير موجود');
    if (comment.userId === reporterId) {
        throw new AppError(400, 'لا يمكنك الإبلاغ عن تعليقك الخاص');
    }

    const existing = await prisma.forumReport.findFirst({
        where: { reporterId, commentId, status: 'pending' },
    });
    if (existing) throw new AppError(409, 'لقد قمت بالإبلاغ عن هذا التعليق بالفعل');

    return prisma.forumReport.create({
        data: { commentId, reporterId, reason, details },
    });
};

// Additional moderation functions live in moderation.service.ts