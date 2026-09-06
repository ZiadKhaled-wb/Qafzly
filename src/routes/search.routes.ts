import { Router } from 'express';
import { validate } from '../middleware/validate';
import * as searchController from '../controllers/search.controller';
import {
    searchQuerySchema,
    searchPathsQuerySchema,
    searchForumQuerySchema,
    searchUsersQuerySchema,
} from '../utils/validators/search.schema';

const router = Router();

// All search endpoints are public
router.get('/', validate(searchQuerySchema), searchController.globalSearch);
router.get('/paths', validate(searchPathsQuerySchema), searchController.searchPaths);
router.get('/forum', validate(searchForumQuerySchema), searchController.searchForum);
router.get('/users', validate(searchUsersQuerySchema), searchController.searchUsers);

export default router;