-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add search vector columns to paths
ALTER TABLE "paths" ADD COLUMN IF NOT EXISTS "search_vector_ar" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('arabic', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce("description", '')), 'B')
  ) STORED;

ALTER TABLE "paths" ADD COLUMN IF NOT EXISTS "search_vector_en" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("titleEn", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("descriptionEn", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "idx_paths_search_ar" ON "paths" USING GIN ("search_vector_ar");
CREATE INDEX IF NOT EXISTS "idx_paths_search_en" ON "paths" USING GIN ("search_vector_en");
CREATE INDEX IF NOT EXISTS "idx_paths_title_trgm" ON "paths" USING GIN ("title" gin_trgm_ops);

-- Add search vector columns to forum_posts
ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "search_vector_ar" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('arabic', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce("content", '')), 'B')
  ) STORED;

ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "search_vector_en" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "idx_forum_posts_search_ar" ON "forum_posts" USING GIN ("search_vector_ar");
CREATE INDEX IF NOT EXISTS "idx_forum_posts_search_en" ON "forum_posts" USING GIN ("search_vector_en");
CREATE INDEX IF NOT EXISTS "idx_forum_posts_title_trgm" ON "forum_posts" USING GIN ("title" gin_trgm_ops);

-- Trigram indexes for users
CREATE INDEX IF NOT EXISTS "idx_users_fullname_trgm" ON "users" USING GIN ("fullName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_users_email_trgm" ON "users" USING GIN ("email" gin_trgm_ops);