import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { sendWeeklySummaryEmail } from '../services/email.service';
import {
    buildWeeklySummaries,
    markDigestSent,
    UserWeeklySummary,
} from '../services/weeklySummary.service';

const LOCK_KEY = 'cron:weekly_summary:lock';
const LOCK_TTL_SECONDS = 5 * 60; // job can take minutes on large user bases
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 min
const STARTUP_DELAY_MS = 45 * 1000; // first check 45s after boot
const CAIRO_TZ = 'Africa/Cairo';
const MIN_DAYS_BETWEEN_DIGESTS = 6; // dedupe window — at-most-once-per-week

/**
 * Returns true when `now` falls within the 08:00 hour on a Monday in Cairo.
 *
 * Uses Intl.DateTimeFormat rather than manual UTC-offset math because Egypt
 * reintroduced DST in 2023 — the offset is UTC+2 in winter and UTC+3 in
 * summer. Hardcoding an offset would silently drift twice a year.
 */
export const isMondayEightAMCairo = (now: Date = new Date()): boolean => {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: CAIRO_TZ,
        weekday: 'long',
        hour: '2-digit',
        hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = parts.find((p) => p.type === 'hour')?.value;
    return weekday === 'Monday' && hour === '08';
};

/**
 * Computes the period [now - 7 days, now). Caller passes `now` for testability.
 */
export const computeDigestPeriod = (now: Date): { start: Date; end: Date } => {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start, end };
};

/**
 * Sends the digest to one user (email + in-app notification). Non-blocking:
 * a failure for a single user is logged and does not abort the batch.
 */
const deliverDigest = async (summary: UserWeeklySummary): Promise<void> => {
    // 1. In-app notification
    try {
        await prisma.notification.create({
            data: {
                userId: summary.userId,
                type: 'weekly_summary',
                title: 'ملخصك الأسبوعي جاهز 📊',
                body: buildNotificationBody(summary),
                link: '/dashboard',
                metadata: {
                    xpEarned: summary.xpEarned,
                    lessonsCompleted: summary.lessonsCompleted,
                    rank: summary.rank,
                    rankChange: summary.rankChange,
                    currentStreak: summary.currentStreak,
                },
            },
        });
    } catch (err) {
        logger.error(
            { err, userId: summary.userId },
            'Weekly summary: failed to create in-app notification'
        );
    }

    // 2. Email — sendWeeklySummaryEmail is non-throwing by contract.
    await sendWeeklySummaryEmail(summary.email, {
        fullName: summary.fullName,
        xpEarned: summary.xpEarned,
        lessonsCompleted: summary.lessonsCompleted,
        currentStreak: summary.currentStreak,
        longestStreak: summary.longestStreak,
        rank: summary.rank,
        rankChange: summary.rankChange,
        badgesEarned: summary.badgesEarned,
        certificatesEarned: summary.certificatesEarned,
        bossBattlesWon: summary.bossBattlesWon,
    });

    // 3. Record the send for next-week rank delta. Non-blocking.
    await markDigestSent(summary.userId, summary.rank, new Date());
};

/**
 * Compact Arabic body for the in-app notification. Mirrors the email
 * headline so the two channels tell the same story.
 */
const buildNotificationBody = (s: UserWeeklySummary): string => {
    const parts: string[] = [];
    if (s.xpEarned > 0) parts.push(`${s.xpEarned} XP`);
    if (s.lessonsCompleted > 0)
        parts.push(`${s.lessonsCompleted} ${s.lessonsCompleted === 1 ? 'درس' : 'دروس'}`);
    if (s.currentStreak > 0) parts.push(`🔥 ${s.currentStreak} أيام`);
    if (s.rankChange !== null && s.rankChange > 0)
        parts.push(`تقدمت ${s.rankChange} مركز`);
    if (parts.length === 0) return 'افتقدناك هذا الأسبوع! ابدأ درساً جديداً النهاردة 👋';
    return `هذا الأسبوع: ${parts.join(' · ')}`;
};

/**
 * Try to acquire the cross-instance lock. Fail-open: on Redis error we run
 * anyway because the digest write is guarded by `lastWeeklySummaryAt`.
 */
const tryAcquireLock = async (): Promise<boolean> => {
    try {
        const result = await redis.set(
            LOCK_KEY,
            String(process.pid),
            'EX',
            LOCK_TTL_SECONDS,
            'NX'
        );
        return result === 'OK';
    } catch (err) {
        logger.warn(
            { err },
            'Weekly summary job: Redis unavailable — running without lock'
        );
        return true;
    }
};

const releaseLock = async (): Promise<void> => {
    try {
        await redis.del(LOCK_KEY);
    } catch (err) {
        logger.warn(
            { err },
            'Weekly summary job: failed to release lock (will expire via TTL)'
        );
    }
};

/**
 * Returns the number of users who received the digest. Exposed for tests
 * and manual invocation.
 */
export const runWeeklySummaryJob = async (
    now: Date = new Date()
): Promise<number> => {
    const { start, end } = computeDigestPeriod(now);

    const summaries = await buildWeeklySummaries(start, end);

    if (summaries.length === 0) {
        logger.debug('Weekly summary: no eligible users');
        return 0;
    }

    // Deliver in parallel; allSettled so one failure doesn't abort the batch.
    const results = await Promise.allSettled(
        summaries.map((s) => deliverDigest(s))
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - sent;

    logger.info(
        { sent, failed, total: summaries.length },
        'Weekly summary: batch completed'
    );

    return sent;
};

/**
 * One full cycle: check timing → check dedupe → acquire lock → run → release.
 * Silent no-op when it's not the target window or the user base was already
 * processed this week.
 */
export const tickWeeklySummary = async (
    now: Date = new Date()
): Promise<void> => {
    if (!isMondayEightAMCairo(now)) return;

    // Dedupe — if the most recent send across the population is less than
    // MIN_DAYS_BETWEEN_DIGESTS ago, we've already run this week.
    try {
        const mostRecent = await prisma.user.findFirst({
            where: { lastWeeklySummaryAt: { not: null } },
            orderBy: { lastWeeklySummaryAt: 'desc' },
            select: { lastWeeklySummaryAt: true },
        });
        if (mostRecent?.lastWeeklySummaryAt) {
            const daysSince =
                (now.getTime() - mostRecent.lastWeeklySummaryAt.getTime()) /
                (1000 * 60 * 60 * 24);
            if (daysSince < MIN_DAYS_BETWEEN_DIGESTS) {
                logger.debug(
                    { daysSince },
                    'Weekly summary: already ran this week, skipping'
                );
                return;
            }
        }
    } catch (err) {
        logger.warn(
            { err },
            'Weekly summary: dedupe check failed — proceeding (idempotent via lastWeeklySummaryAt)'
        );
    }

    let locked = false;
    try {
        locked = await tryAcquireLock();
        if (!locked) {
            logger.debug(
                'Weekly summary job: another instance holds the lock, skipping'
            );
            return;
        }
        await runWeeklySummaryJob(now);
    } catch (err) {
        // Swallow — a failed cycle must not crash the process.
        logger.error({ err }, 'Weekly summary job failed');
    } finally {
        if (locked) {
            await releaseLock();
        }
    }
};

let intervalHandle: NodeJS.Timeout | null = null;
let startupHandle: NodeJS.Timeout | null = null;

export const startWeeklySummaryJob = (
    intervalMs: number = CHECK_INTERVAL_MS
): void => {
    if (intervalHandle || startupHandle) {
        logger.warn('Weekly summary job already started');
        return;
    }

    startupHandle = setTimeout(() => {
        void tickWeeklySummary();
        startupHandle = null;
    }, STARTUP_DELAY_MS);
    startupHandle.unref();

    intervalHandle = setInterval(() => {
        void tickWeeklySummary();
    }, intervalMs);
    intervalHandle.unref();

    logger.info({ intervalMs }, 'Weekly summary job started');
};

export const stopWeeklySummaryJob = (): void => {
    if (startupHandle) {
        clearTimeout(startupHandle);
        startupHandle = null;
    }
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        logger.info('Weekly summary job stopped');
    }
};