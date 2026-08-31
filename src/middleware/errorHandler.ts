import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { ZodError } from 'zod';

export const errorHandler = (
        err: Error | AppError | ZodError,
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        // Log error
        logger.error({ err, path: req.path, method: req.method }, 'Error occurred');

        if (err instanceof ZodError) {
            return res.status(400).json({
            success: false,
            data: null,
            message: 'Validation failed',
            errors: err.flatten(),
            meta: null,
            });
        }

        if (err instanceof AppError) {
            return res.status(err.statusCode).json({
            success: false,
            data: null,
            message: err.message,
            errors: err.metadata || null,
            meta: null,
            });
        }

        // Unknown error
        return res.status(500).json({
            success: false,
            data: null,
            message: 'Internal server error',
            errors: null,
            meta: null,
        });
};