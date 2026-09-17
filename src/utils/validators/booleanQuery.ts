import { z } from 'zod';

/**
 * Parse an optional query-string boolean while preserving `undefined` for
 * params that were NOT sent. Handles both string ('true'/'false') and
 * native boolean inputs.
 *
 * ⚠️ Do NOT use `z.coerce.boolean()` for query params.
 * `Boolean('false')` is `true` (a non-empty string is truthy), so
 * `?isFeatured=false` silently coerces to `true`.
 *
 * ⚠️ Do NOT use `.optional().transform(v => v === 'true')` either.
 * Zod runs `.transform()` on `undefined`, so an omitted param becomes
 * `false` — adding an unintended filter.
 *
 * This helper correctly distinguishes three cases:
 *   'true'   → true
 *   'false'  → false
 *   omitted  → undefined   (no filter applied)
 */
export const optionalBooleanQuery = z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => {
        if (v === undefined) return undefined;
        if (typeof v === 'boolean') return v;
        return v === 'true';
    });