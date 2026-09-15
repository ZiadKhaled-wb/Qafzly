import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { optionalAuth } from '../middleware/optionalAuth';
import { validate } from '../middleware/validate';
import * as forumController from '../controllers/forum.controller';
import * as forumSchemas from '../utils/validators/forum.schema';

const router = Router();

// -----------------------------------------------------------------------------
// Public routes
// -----------------------------------------------------------------------------
router.get('/categories', validate(forumSchemas.listCategoriesSchema), forumController.listCategories);
router.get('/posts', validate(forumSchemas.listPostsQuerySchema), forumController.listPosts);

// optionalAuth so admins get moderator context and owners can see their own hidden posts
// (previously had no auth middleware, so req.user was always undefined and the
// admin/owner-bypass logic in forum.service.getPostById never fired)
router.get('/posts/:id', optionalAuth, forumController.getPost);

router.get('/posts/:postId/comments', validate(forumSchemas.listCommentsQuerySchema), forumController.getComments);
router.get('/search', forumController.searchPosts);

// -----------------------------------------------------------------------------
// Authenticated — Posts
// -----------------------------------------------------------------------------
router.post('/posts', authenticate, validate(forumSchemas.createPostSchema), forumController.createPost);
router.put('/posts/:id', authenticate, validate(forumSchemas.updatePostSchema), forumController.updatePost);
router.delete('/posts/:id', authenticate, forumController.deletePost);

// -----------------------------------------------------------------------------
// Authenticated — Comments
// -----------------------------------------------------------------------------
router.post('/posts/:postId/comments', authenticate, validate(forumSchemas.createCommentSchema), forumController.addComment);
router.put('/comments/:id', authenticate, validate(forumSchemas.updateCommentSchema), forumController.updateComment);
router.delete('/comments/:id', authenticate, forumController.deleteComment);

// -----------------------------------------------------------------------------
// Voting
// -----------------------------------------------------------------------------
router.post('/posts/:id/upvote', authenticate, forumController.upvotePost);
router.post('/posts/:id/downvote', authenticate, forumController.downvotePost);
router.post('/comments/:id/upvote', authenticate, forumController.upvoteComment);
router.post('/comments/:id/downvote', authenticate, forumController.downvoteComment);

// -----------------------------------------------------------------------------
// Best answer
// -----------------------------------------------------------------------------
router.post(
    '/posts/:id/mark-answer',
    authenticate,
    validate(forumSchemas.markBestAnswerSchema),
    forumController.markBestAnswer
);

// -----------------------------------------------------------------------------
// Reporting
// -----------------------------------------------------------------------------
router.post(
    '/posts/:id/report',
    authenticate,
    validate(forumSchemas.reportPostSchema),
    forumController.reportPost
);
router.post(
    '/comments/:id/report',
    authenticate,
    validate(forumSchemas.reportCommentSchema),
    forumController.reportComment
);

export default router;