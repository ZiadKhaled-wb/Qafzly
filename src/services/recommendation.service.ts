import { prisma } from '../config/database';
import { Prisma, PathDifficulty } from '@prisma/client';

interface RecommendationFilters {
    categoryId?: string;
    difficulty?: string;
}

/**
 * Difficulty adjacency for cold-start and skill-matched fills.
 * A beginner must never be primary-served ADVANCED; an advanced user must
 * never be primary-served BEGINNER. ALL_LEVELS sits right after the user's
 * own level because it is universally appropriate.
 */
const DIFFICULTY_ADJACENCY: Record<string, PathDifficulty[]> = {
    BEGINNER: [
        PathDifficulty.BEGINNER,
        PathDifficulty.ALL_LEVELS,
        PathDifficulty.INTERMEDIATE,
    ],
    INTERMEDIATE: [
        PathDifficulty.INTERMEDIATE,
        PathDifficulty.ALL_LEVELS,
        PathDifficulty.BEGINNER,
        PathDifficulty.ADVANCED,
    ],
    ADVANCED: [
        PathDifficulty.ADVANCED,
        PathDifficulty.ALL_LEVELS,
        PathDifficulty.INTERMEDIATE,
    ],
};

/**
 * Clean Path projection for all recommendation responses.
 *
 * Excludes `deletedAt` (always null for visible records) and the two
 * `Unsupported("tsvector")` columns. Never `SELECT *` against `paths` —
 * Prisma cannot deserialize the tsvector columns.
 */
const PATH_SELECT = {
    id: true,
    title: true,
    titleEn: true,
    description: true,
    descriptionEn: true,
    categoryId: true,
    difficulty: true,
    price: true,
    currency: true,
    featuredImage: true,
    tags: true,
    prerequisites: true,
    estimatedDuration: true,
    isPublished: true,
    isFeatured: true,
    createdAt: true,
    updatedAt: true,
    category: true,
} as const;

type CleanPath = Prisma.PathGetPayload<{ select: typeof PATH_SELECT }>;

// -------------------------------------------------------------------------
// Popular — highest total enrollment count.
// Deterministic ordering: enrollments DESC → createdAt DESC → id ASC.
//
// `excludeIds` is used by the personalized fallback chain so enrolled paths
// never leak back in through the popular stage.
// -------------------------------------------------------------------------
export const getPopularPaths = async (
    limit: number,
    filters: RecommendationFilters = {},
    excludeIds: string[] = []
): Promise<CleanPath[]> => {
    const where: Prisma.PathWhereInput = {
        deletedAt: null,
        isPublished: true,
    };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.difficulty) where.difficulty = filters.difficulty as PathDifficulty;
    if (excludeIds.length > 0) where.id = { notIn: excludeIds };

    return prisma.path.findMany({
        where,
        orderBy: [
            { enrollments: { _count: 'desc' } },
            { createdAt: 'desc' },
            { id: 'asc' },
        ],
        take: limit,
        select: PATH_SELECT,
    });
};

// -------------------------------------------------------------------------
// Trending — most enrollments in the last 30 days.
//
// Uses two queries: (1) a raw SQL aggregation that returns only `id` and the
// score, and (2) a Prisma `findMany` that fetches the full Path shape for
// those IDs with the clean projection. This keeps the raw SQL from ever
// touching the tsvector columns while preserving the ranked order.
//
// NOTE on type casts: `Path.categoryId` and `Enrollment.pathId` are `text`
// columns (no `@db.Uuid` in schema.prisma). Prisma binds string parameters
// as `text`, so the comparison is `text = text`. Do NOT add `::uuid` casts
// to the parameters — Postgres rejects `text = uuid`. Only `difficulty` (a
// Postgres enum) needs a column-side cast to `::text`.
// -------------------------------------------------------------------------
export const getTrendingPaths = async (
    limit: number,
    filters: RecommendationFilters = {},
    excludeIds: string[] = []
): Promise<CleanPath[]> => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Over-fetch to leave headroom for the post-filter exclusion of enrolled
    // IDs without a second DB round-trip.
    const fetchSize = limit + excludeIds.length;

    const rows = await prisma.$queryRaw<Array<{ id: string; recent_enrollments: bigint }>>`
        SELECT p.id, COUNT(e.id) AS recent_enrollments
        FROM "paths" p
        JOIN "enrollments" e ON e."pathId" = p.id
        WHERE e."enrolledAt" >= ${thirtyDaysAgo}
          AND p."deletedAt" IS NULL
          AND p."isPublished" = true
          ${filters.categoryId
            ? Prisma.sql`AND p."categoryId" = ${filters.categoryId}`
            : Prisma.empty}
          ${filters.difficulty
            ? Prisma.sql`AND p."difficulty"::text = ${filters.difficulty}`
            : Prisma.empty}
        GROUP BY p.id
        ORDER BY recent_enrollments DESC, p."createdAt" DESC, p.id ASC
        LIMIT ${fetchSize}
    `;

    const filteredRows =
        excludeIds.length > 0
            ? rows.filter((r) => !excludeIds.includes(r.id))
            : rows;
    const topRows = filteredRows.slice(0, limit);

    if (topRows.length === 0) return [];

    const ids = topRows.map((r) => r.id);
    const paths = await prisma.path.findMany({
        where: { id: { in: ids } },
        select: PATH_SELECT,
    });

    // Preserve the SQL-provided ranking order.
    const byId = new Map(paths.map((p) => [p.id, p] as const));
    return ids
        .map((id) => byId.get(id))
        .filter((p): p is CleanPath => Boolean(p));
};

// -------------------------------------------------------------------------
// Related — co-enrollment signal ("users who took X also took Y").
// Same two-query pattern as trending. Type casts deliberately omitted on
// `pathId` because both columns are `text` in Postgres.
// -------------------------------------------------------------------------
export const getRelatedPaths = async (
    pathId: string,
    limit: number
): Promise<CleanPath[]> => {
    const rows = await prisma.$queryRaw<Array<{ id: string; co_enrollment_count: bigint }>>`
        SELECT p2.id, COUNT(DISTINCT e2."userId") AS co_enrollment_count
        FROM "enrollments" e1
        JOIN "enrollments" e2 ON e2."userId" = e1."userId"
        JOIN "paths" p2 ON p2.id = e2."pathId"
        WHERE e1."pathId" = ${pathId}
          AND e2."pathId" != ${pathId}
          AND p2."deletedAt" IS NULL
          AND p2."isPublished" = true
        GROUP BY p2.id
        ORDER BY co_enrollment_count DESC, p2."createdAt" DESC, p2.id ASC
        LIMIT ${limit}
    `;

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const paths = await prisma.path.findMany({
        where: { id: { in: ids } },
        select: PATH_SELECT,
    });

    const byId = new Map(paths.map((p) => [p.id, p] as const));
    return ids
        .map((id) => byId.get(id))
        .filter((p): p is CleanPath => Boolean(p));
};

// -------------------------------------------------------------------------
// Personalized.
//
// Warm-start (has active enrollments):
//   1. Category-matched, weighted by enrollment frequency
//   2. Skill-matched popular
//   3. Popular (with enrolled paths excluded)
//   4. Trending (with enrolled paths excluded)
//
// Cold-start (no active enrollments):
//   1. Skill-matched popular
//   2. Popular
//   3. Trending
//
// All enrollments (active or not) are excluded from every stage so a user
// never sees a path they previously bought or were enrolled in.
// -------------------------------------------------------------------------
export const getPersonalizedRecommendations = async (
    userId: string,
    limit: number
): Promise<CleanPath[]> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { skillLevel: true },
    });

    const userSkill: PathDifficulty =
        (user?.skillLevel as PathDifficulty) ?? PathDifficulty.BEGINNER;
    const preferredDifficulties =
        DIFFICULTY_ADJACENCY[userSkill] ?? DIFFICULTY_ADJACENCY.BEGINNER;

    const [activeEnrollments, allEnrollments] = await Promise.all([
        prisma.enrollment.findMany({
            where: { userId, isActive: true },
            select: { path: { select: { categoryId: true } } },
        }),
        prisma.enrollment.findMany({
            where: { userId },
            select: { pathId: true },
        }),
    ]);

    const enrolledPathIds = allEnrollments.map((e) => e.pathId);

    const categoryWeights = new Map<string, number>();
    for (const e of activeEnrollments) {
        const catId = e.path?.categoryId;
        if (catId) categoryWeights.set(catId, (categoryWeights.get(catId) ?? 0) + 1);
    }

    const collected: CleanPath[] = [];
    const seen = new Set<string>();

    /** Appends new-only paths. Returns true once the limit is reached. */
    const addIfNew = (paths: CleanPath[]): boolean => {
        for (const p of paths) {
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            collected.push(p);
            if (collected.length >= limit) return true;
        }
        return false;
    };

    // STAGE 1 (warm only): category-matched, weighted by enrollment frequency.
    if (categoryWeights.size > 0) {
        const categoryIds = Array.from(categoryWeights.keys());
        const primary = await prisma.path.findMany({
            where: {
                categoryId: { in: categoryIds },
                id: { notIn: enrolledPathIds },
                deletedAt: null,
                isPublished: true,
            },
            orderBy: [
                { enrollments: { _count: 'desc' } },
                { createdAt: 'desc' },
                { id: 'asc' },
            ],
            take: limit * 3, // over-fetch — re-ranked below
            select: {
                ...PATH_SELECT,
                _count: { select: { enrollments: true } },
            },
        });

        // Layer category weight on top of enrollment count, then mirror the
        // SQL tie-breakers so ordering stays deterministic across requests.
        primary.sort((a, b) => {
            const aw = categoryWeights.get(a.categoryId ?? '') ?? 0;
            const bw = categoryWeights.get(b.categoryId ?? '') ?? 0;
            if (aw !== bw) return bw - aw;
            const ae = a._count.enrollments;
            const be = b._count.enrollments;
            if (ae !== be) return be - ae;
            if (a.createdAt.getTime() !== b.createdAt.getTime()) {
                return b.createdAt.getTime() - a.createdAt.getTime();
            }
            return a.id.localeCompare(b.id);
        });

        const cleaned: CleanPath[] = primary.map(
            ({ _count, ...rest }) => rest as CleanPath
        );
        if (addIfNew(cleaned)) return collected;
    }

    // STAGE 2: skill-matched popular.
    const skillMatched = await prisma.path.findMany({
        where: {
            deletedAt: null,
            isPublished: true,
            difficulty: { in: preferredDifficulties },
            id: { notIn: enrolledPathIds },
        },
        orderBy: [
            { enrollments: { _count: 'desc' } },
            { createdAt: 'desc' },
            { id: 'asc' },
        ],
        take: limit * 2,
        select: PATH_SELECT,
    });
    if (addIfNew(skillMatched)) return collected;

    // STAGE 3: unfiltered popular — with enrolled paths excluded.
    const popular = await getPopularPaths(limit * 2, {}, enrolledPathIds);
    if (addIfNew(popular)) return collected;

    // STAGE 4: trending — with enrolled paths excluded.
    const trending = await getTrendingPaths(limit * 2, {}, enrolledPathIds);
    if (addIfNew(trending)) return collected;

    return collected;
};