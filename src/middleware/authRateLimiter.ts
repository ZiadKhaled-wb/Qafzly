import { createRateLimiter } from './rateLimiter';

/**
 * Stricter limiter for auth endpoints.
 * Buckets are per-IP-per-endpoint, so /login and /register each have
 * their own counter. 10 requests per minute.
 *
 * Preserves the exact behavior of the previous implementation.
 */
export const authRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: 'auth',
    keyGenerator: (req) => `ip:${req.ip || 'unknown'}:${req.path}`,
    // Auth limiter also fails open — a Redis outage already breaks login
    // (auth.service reads failed_attempts:* from Redis before checking
    // the password), so fail-closed here adds no security, only outages.
});