import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { AppError } from '../utils/AppError';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;

export const authRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const key = `rate:${req.ip}:${req.path}`;
    try {
        const current = await redis.incr(key);
        if (current === 1) {
        await redis.expire(key, WINDOW_SECONDS);
        }
        if (current > MAX_REQUESTS) {
        throw new AppError(429, 'محاولات كثيرة، يرجى المحاولة لاحقاً');
        }
        next();
    } catch (error) {
        next(error);
    }
};