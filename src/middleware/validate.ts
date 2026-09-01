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

                // Replace request properties with the parsed (and transformed) values
            req.body = parsed.body;
            req.query = parsed.query;
            req.params = parsed.params;
            
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