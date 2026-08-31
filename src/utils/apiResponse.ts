import { Response } from 'express';

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export const apiResponse = <T>(
        res: Response,
        statusCode: number,
        data?: T,
        message?: string,
        errors?: any,
        meta?: PaginationMeta
    ): void => {
        res.status(statusCode).json({
            success: statusCode < 400,
            data: data ?? null,
            message: message ?? null,
            errors: errors ?? null,
            meta: meta ?? null,
        });
};