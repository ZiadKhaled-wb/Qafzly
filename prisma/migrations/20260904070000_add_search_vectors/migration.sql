-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Courses: add search vector columns and indexes
ALTER TABLE "courses" ADD COLUMN "search_vector_ar" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('arabic', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce("description", '')), 'B')
  ) STORED;

ALTER TABLE "courses" ADD COLUMN "search_vector_en" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("titleEn", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("descriptionEn", '')), 'B')
  ) STORED;

CREATE INDEX "idx_courses_search_ar" ON "courses" USING GIN ("search_vector_ar");
CREATE INDEX "idx_courses_search_en" ON "courses" USING GIN ("search_vector_en");
CREATE INDEX "idx_courses_title_trgm" ON "courses" USING GIN ("title" gin_trgm_ops);

-- Forum posts: add search vector columns and indexes
ALTER TABLE "forum_posts" ADD COLUMN "search_vector_ar" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('arabic', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce("content", '')), 'B')
  ) STORED;

ALTER TABLE "forum_posts" ADD COLUMN "search_vector_en" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
  ) STORED;

CREATE INDEX "idx_forum_posts_search_ar" ON "forum_posts" USING GIN ("search_vector_ar");
CREATE INDEX "idx_forum_posts_search_en" ON "forum_posts" USING GIN ("search_vector_en");
CREATE INDEX "idx_forum_posts_title_trgm" ON "forum_posts" USING GIN ("title" gin_trgm_ops);

-- User search trigram indexes
CREATE INDEX "idx_users_fullname_trgm" ON "users" USING GIN ("fullName" gin_trgm_ops);
CREATE INDEX "idx_users_email_trgm" ON "users" USING GIN ("email" gin_trgm_ops);