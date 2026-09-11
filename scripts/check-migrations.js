#!/usr/bin/env node
/**
 * Pre-flight check for migration files.
 *
 * Prisma has a known open bug (#24496, #15654) where `migrate dev` generates
 * `ALTER COLUMN ... DROP DEFAULT` on PostgreSQL generated columns, which
 * PostgreSQL rejects with error 42601. Because our search_vector_ar/en
 * columns are generated, every bare `migrate dev` produces a broken migration.
 *
 * This script scans every migration.sql under prisma/migrations and fails if
 * it finds:
 *   1. A DROP DEFAULT on a search_vector column (the Prisma bug)
 *   2. A DROP COLUMN on a search_vector column (accidental data loss)
 *
 * Exit code 0 = clean. Exit code 1 = violation found; the migration must be
 * manually edited before it can be applied.
 *
 * Usage:
 *   npm run check:migrations
 *   node scripts/check-migrations.js
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

const RULES = [
    {
        name: 'Prisma bug #24496: DROP DEFAULT on generated column',
        pattern: /ALTER\s+TABLE[\s\S]*?ALTER\s+COLUMN\s+"search_vector_(ar|en)"\s+DROP\s+DEFAULT/gi,
        message:
            'Prisma generated `ALTER COLUMN ... DROP DEFAULT` on a generated column. ' +
            'PostgreSQL rejects this with error 42601. Delete this line from the migration.sql, ' +
            'then re-run `npx prisma migrate deploy`.',
    },
    {
        name: 'Accidental DROP COLUMN on search vector',
        pattern: /ALTER\s+TABLE[\s\S]*?DROP\s+COLUMN\s+"search_vector_(ar|en)"/gi,
        message:
            'Migration attempts to drop a search_vector column. This breaks full-text search. ' +
            'If intentional, update this check; otherwise remove the line.',
    },
    {
        name: 'Accidental DROP INDEX on search/trigram index',
        pattern: /DROP\s+INDEX\s+"(idx_(paths|forum_posts|users)_[a-z_]+|idx_(paths|forum_posts)_title_trgm|idx_users_(email|fullname)_trgm)"/gi,
        message:
            'Prisma generated a DROP INDEX for a search or trigram index that it cannot see ' +
            '(because the indexes exist only in raw SQL). Delete this line from the migration.sql. ' +
            'If it is a real index removal, update this check to allow it.',
    },
];

function walkMigrationFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walkMigrationFiles(full));
        } else if (entry.name === 'migration.sql') {
            out.push(full);
        }
    }
    return out;
}

function main() {
    const files = walkMigrationFiles(MIGRATIONS_DIR);

    if (files.length === 0) {
        console.error('✖ No migration.sql files found under', MIGRATIONS_DIR);
        process.exit(1);
    }

    const violations = [];

    for (const file of files) {
        const sql = fs.readFileSync(file, 'utf8');
        const relative = path.relative(process.cwd(), file);

        for (const rule of RULES) {
            rule.pattern.lastIndex = 0;
            let match;
            while ((match = rule.pattern.exec(sql)) !== null) {
                const upTo = sql.slice(0, match.index);
                const line = upTo.split('\n').length;
                violations.push({
                    file: relative,
                    line,
                    rule: rule.name,
                    match: match[0].replace(/\s+/g, ' ').trim().slice(0, 120),
                    message: rule.message,
                });
            }
        }
    }

    if (violations.length === 0) {
        console.log(`✔ ${files.length} migration file(s) scanned. No violations.`);
        process.exit(0);
    }

    console.error('\n✖ Migration check failed. Violations:\n');
    for (const v of violations) {
        console.error(`  ${v.file}:${v.line}`);
        console.error(`    Rule:   ${v.rule}`);
        console.error(`    Match:  ${v.match}`);
        console.error(`    Action: ${v.message}\n`);
    }
    console.error(`Found ${violations.length} violation(s). Fix the migration.sql file(s) and re-run.\n`);
    process.exit(1);
}

main();