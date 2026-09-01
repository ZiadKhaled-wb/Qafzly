import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as forumController from '../controllers/forum.controller';
import * as forumSchemas from '../utils/validators/forum.schema';

const router = Router();

// Public routes
router.get('/categories', validate(forumSchemas.listCategoriesSchema), forumController.listCategories);
router.get('/posts', validate(forumSchemas.listPostsQuerySchema), forumController.listPosts);
router.get('/posts/:id', forumController.getPost);
router.get('/posts/:postId/comments', validate(forumSchemas.listCommentsQuerySchema), forumController.getComments);
router.get('/search', forumController.searchPosts);

// Authenticated routes
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
router.post('/posts/:id/mark-answer', authenticate, validate(forumSchemas.markBestAnswerSchema), forumController.markBestAnswer);

export default router;