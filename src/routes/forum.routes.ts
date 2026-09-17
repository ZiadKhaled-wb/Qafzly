import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { optionalAuth } from '../middleware/optionalAuth';
import { validate } from '../middleware/validate';
import * as forumController from '../controllers/forum.controller';
import * as forumSchemas from '../utils/validators/forum.schema';

const router = Router();

// -----------------------------------------------------------------------------
// Public routes (optionalAuth lets us inject userVote when a token is present)
// -----------------------------------------------------------------------------
router.get(
    '/categories',
    validate(forumSchemas.listCategoriesSchema),
    forumController.listCategories
);

router.get(
    '/posts',
    optionalAuth,
    validate(forumSchemas.listPostsQuerySchema),
    forumController.listPosts
);

router.get('/posts/:id', optionalAuth, forumController.getPost);

router.get(
    '/posts/:postId/comments',
    optionalAuth,
    validate(forumSchemas.listCommentsQuerySchema),
    forumController.getComments
);

router.get('/search', optionalAuth, forumController.searchPosts);

// -----------------------------------------------------------------------------
// Authenticated routes
// -----------------------------------------------------------------------------
router.post('/posts', authenticate, validate(forumSchemas.createPostSchema), forumController.createPost);
router.put('/posts/:id', authenticate, validate(forumSchemas.updatePostSchema), forumController.updatePost);
router.delete('/posts/:id', authenticate, forumController.deletePost);
router.post('/posts/:postId/comments', authenticate, validate(forumSchemas.createCommentSchema), forumController.addComment);
router.put('/comments/:id', authenticate, validate(forumSchemas.updateCommentSchema), forumController.updateComment);
router.delete('/comments/:id', authenticate, forumController.deleteComment);

// Voting
router.post('/posts/:id/upvote', authenticate, forumController.upvotePost);
router.post('/posts/:id/downvote', authenticate, forumController.downvotePost);
router.post('/comments/:id/upvote', authenticate, forumController.upvoteComment);
router.post('/comments/:id/downvote', authenticate, forumController.downvoteComment);

// Best answer
router.post(
    '/posts/:id/mark-answer',
    authenticate,
    validate(forumSchemas.markBestAnswerSchema),
    forumController.markBestAnswer
);

// Reporting
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