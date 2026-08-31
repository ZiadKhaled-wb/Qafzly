import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { config } from '../config/env';

export interface AuthPayload {
    userId: string;
    email: string;
    role: string;
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError(401, 'Authentication required');
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.jwtAccessSecret) as AuthPayload;
        (req as any).user = decoded;
        next();
    } catch (err) {
        throw new AppError(401, 'Invalid or expired token');
    }
};