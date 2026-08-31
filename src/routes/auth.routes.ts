import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/authRateLimiter';
import { authenticate } from '../middleware/authenticate';
import * as authController from '../controllers/auth.controller';
import {
    registerSchema,
    loginSchema,
    refreshSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from '../utils/validators/auth.schema';

const router = Router();

// Public routes with rate limiting
router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Authenticated routes
router.post('/logout', authenticate, authController.logout);

export default router;