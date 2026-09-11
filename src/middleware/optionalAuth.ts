import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AuthPayload } from './authenticate';

/**
 * Same as `authenticate` but does not reject when the request has no token.
 *
 * - If a valid Bearer token is present → `req.user` is populated.
 * - If no token is present → the request continues as anonymous.
 * - If a token is present but invalid/expired → the request still continues
 *   as anonymous (we prefer serving public content over rejecting here;
 *   stricter endpoints should use `authenticate`).
 *
 * Used on public endpoints that want to enrich their response for
 * authenticated users (e.g. `isAccessible` flags on lessons) without
 * requiring a token.
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    // If an upstream middleware already set req.user, don't overwrite
    if ((req as any).user) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.jwtAccessSecret) as AuthPayload;
        (req as any).user = decoded;
    } catch {
        // Invalid/expired token → treat as anonymous, do NOT reject.
        // This lets browsers with a stale token still see public content.
    }
    next();
};