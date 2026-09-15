import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { ForumPost, ForumComment, Prisma } from '@prisma/client';

// Helper to calculate pagination meta
const getPaginationMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const listCategories = async (params: any) => {
  const { page, limit, search, isActive } = params;
  const where: any = {};
  if (search) {
    where.OR = [
      { nameAr: { contains: search, mode: 'insensitive' } },
      { nameEn: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (isActive !== undefined) where.isActive = isActive;

  const [categories, total] = await Promise.all([
    prisma.forumCategory.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.forumCategory.count({ where }),
  ]);
  return { categories, ...getPaginationMeta(page, limit, total) };
};

export const createPost = async (userId: string, data: any) => {
  const { title, content, categoryId, pathId, lessonId } = data;
  const post = await prisma.forumPost.create({
    data: {
      userId,
      title,
      content,
      categoryId,
      pathId,
      lessonId,
    },
  });
  return post;
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
  if (post.status === 'hidden' && !isAdmin && post.userId !== userId) throw new AppError(404, 'المنشور غير موجود');
  // Increment view count (fire and forget)
  prisma.forumPost.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  return post;
};

export const listPosts = async (params: any) => {
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

  const orderBy: any = {};
  if (sortBy === 'upvotes') orderBy.upvotes = order;
  else if (sortBy === 'viewCount') orderBy.viewCount = order;
  else orderBy.createdAt = order;

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
  return { posts, ...getPaginationMeta(page, limit, total) };
};

export const updatePost = async (postId: string, userId: string, data: any, isAdmin: boolean = false) => {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt) throw new AppError(404, 'المنشور غير موجود');
  if (post.userId !== userId && !isAdmin) throw new AppError(403, 'غير مصرح لك بتعديل هذا المنشور');

  const updated = await prisma.forumPost.update({
    where: { id: postId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
  return updated;
};

export const deletePost = async (postId: string, userId: string, isAdmin: boolean = false) => {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt) throw new AppError(404, 'المنشور غير موجود');
  if (post.userId !== userId && !isAdmin) throw new AppError(403, 'غير مصرح لك بحذف هذا المنشور');

  await prisma.forumPost.update({
    where: { id: postId },
    data: { deletedAt: new Date(), status: 'deleted' },
  });
};

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
  });
  // Increment comment count
  await prisma.forumPost.update({
    where: { id: postId },
    data: { commentCount: { increment: 1 } },
  });
  return comment;
};

export const getComments = async (postId: string, params: any) => {
  const { page, limit } = params;
  const where: any = { postId, deletedAt: null, status: 'published' };
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
          include: { user: { select: { id: true, fullName: true, displayName: true } } },
        },
      },
    }),
    prisma.forumComment.count({ where }),
  ]);
  return { comments, ...getPaginationMeta(page, limit, total) };
};

export const updateComment = async (commentId: string, userId: string, data: any, isAdmin: boolean = false) => {
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.deletedAt) throw new AppError(404, 'التعليق غير موجود');
  if (comment.userId !== userId && !isAdmin) throw new AppError(403, 'غير مصرح لك بتعديل هذا التعليق');

  const updated = await prisma.forumComment.update({
    where: { id: commentId },
    data: { content: data.content, isEdited: true },
  });
  return updated;
};

export const deleteComment = async (commentId: string, userId: string, isAdmin: boolean = false) => {
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.deletedAt) throw new AppError(404, 'التعليق غير موجود');
  if (comment.userId !== userId && !isAdmin) throw new AppError(403, 'غير مصرح لك بحذف هذا التعليق');

  await prisma.forumComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date(), status: 'deleted' },
  });
  // Decrement comment count on post
  await prisma.forumPost.update({
    where: { id: comment.postId },
    data: { commentCount: { decrement: 1 } },
  });
};

export const vote = async (targetType: 'post' | 'comment', targetId: string, userId: string, voteType: 1 | -1) => {
  // Validate target exists
  if (targetType === 'post') {
    const post = await prisma.forumPost.findUnique({ where: { id: targetId } });
    if (!post || post.deletedAt) throw new AppError(404, 'المنشور غير موجود');
  } else {
    const comment = await prisma.forumComment.findUnique({ where: { id: targetId } });
    if (!comment || comment.deletedAt) throw new AppError(404, 'التعليق غير موجود');
  }

  // Check existing vote
  const existing = await prisma.forumVote.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
  });

  if (existing) {
    if (existing.voteType === voteType) {
      // Remove vote (toggle off)
      await prisma.forumVote.delete({ where: { id: existing.id } });
      // Adjust counts
      const delta = voteType === 1 ? -1 : 1;
      if (targetType === 'post') {
        await prisma.forumPost.update({ where: { id: targetId }, data: voteType === 1 ? { upvotes: { increment: -1 } } : { downvotes: { increment: -1 } } });
      } else {
        await prisma.forumComment.update({ where: { id: targetId }, data: voteType === 1 ? { upvotes: { increment: -1 } } : { downvotes: { increment: -1 } } });
      }
    } else {
      // Change vote
      await prisma.forumVote.update({ where: { id: existing.id }, data: { voteType } });
      // Adjust counts: remove old, add new
      const oldDelta = existing.voteType === 1 ? -1 : 1;
      const newDelta = voteType === 1 ? 1 : -1;
      if (targetType === 'post') {
        const data: any = {};
        if (existing.voteType === 1) data.upvotes = { increment: -1 };
        else data.downvotes = { increment: -1 };
        if (voteType === 1) data.upvotes = { increment: 1 };
        else data.downvotes = { increment: 1 };
        await prisma.forumPost.update({ where: { id: targetId }, data });
      } else {
        const data: any = {};
        if (existing.voteType === 1) data.upvotes = { increment: -1 };
        else data.downvotes = { increment: -1 };
        if (voteType === 1) data.upvotes = { increment: 1 };
        else data.downvotes = { increment: 1 };
        await prisma.forumComment.update({ where: { id: targetId }, data });
      }
    }
  } else {
    // Create new vote
    await prisma.forumVote.create({
      data: { userId, targetType, targetId, voteType },
    });
    if (targetType === 'post') {
      await prisma.forumPost.update({
        where: { id: targetId },
        data: voteType === 1 ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
      });
    } else {
      await prisma.forumComment.update({
        where: { id: targetId },
        data: voteType === 1 ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
      });
    }
  }
};

export const markBestAnswer = async (postId: string, commentId: string, userId: string) => {
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new AppError(404, 'المنشور غير موجود');
  if (post.userId !== userId) throw new AppError(403, 'فقط صاحب المنشور يمكنه تحديد أفضل إجابة');

  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.postId !== postId) throw new AppError(404, 'التعليق غير موجود في هذا المنشور');

  // Clear previous best answer
  await prisma.forumComment.updateMany({
    where: { postId, isBestAnswer: true },
    data: { isBestAnswer: false },
  });
  // Mark new best answer
  await prisma.forumComment.update({
    where: { id: commentId },
    data: { isBestAnswer: true },
  });
  // Mark post as solved
  await prisma.forumPost.update({
    where: { id: postId },
    data: { isSolved: true },
  });
  return prisma.forumPost.findUnique({ where: { id: postId } });
};

export const searchPosts = async (query: string, params: any) => {
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
        user: { select: { id: true, fullName: true, displayName: true } },
        category: { select: { id: true, nameAr: true, nameEn: true } },
      },
    }),
    prisma.forumPost.count({ where }),
  ]);
  return { posts, ...getPaginationMeta(page, limit, total) };
};

// -----------------------------------------------------------------------------
// Reporting
// -----------------------------------------------------------------------------

const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'off-topic', 'other'];

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
// Additional moderation functions can be placed in moderation.service.ts