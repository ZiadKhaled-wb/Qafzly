import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';

export const validate = (schema: ZodType<any, any, any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
        const parsed = schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // In Express 5, req.query and req.params are getter-only.
        // We must redefine them on the request instance to assign new values.
        if (parsed.body !== undefined) {
            req.body = parsed.body;
        }

        if (parsed.query !== undefined) {
            Object.defineProperty(req, 'query', {
            value: parsed.query,
            writable: true,
            configurable: true,
            });
        }

        if (parsed.params !== undefined) {
            Object.defineProperty(req, 'params', {
            value: parsed.params,
            writable: true,
            configurable: true,
            });
        }

        next();
        } catch (err) {
        if (err instanceof ZodError) {
            return res.status(400).json({
            success: false,
            data: null,
            message: 'Validation failed',
            errors: err.flatten(),
            meta: null,
            });
        }
        next(err);
        }
    };
};