import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;
const requests = new Map<string, number[]>();

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    const existing = requests.get(key) || [];
    const recent = existing.filter(ts => ts > windowStart);
    if (recent.length >= MAX_REQUESTS) {
        throw new AppError(429, 'Too many requests, please try again later.');
    }
    recent.push(now);
    requests.set(key, recent);
    next();
};