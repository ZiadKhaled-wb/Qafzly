/*
  Warnings:

  - You are about to drop the column `search_vector_ar` on the `paths` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector_en` on the `paths` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_forum_posts_search_ar";

-- DropIndex
DROP INDEX "idx_forum_posts_search_en";

-- DropIndex
DROP INDEX "idx_forum_posts_title_trgm";

-- DropIndex
DROP INDEX "idx_paths_search_ar";

-- DropIndex
DROP INDEX "idx_paths_search_en";

-- DropIndex
DROP INDEX "idx_paths_title_trgm";

-- DropIndex
DROP INDEX "idx_users_email_trgm";

-- DropIndex
DROP INDEX "idx_users_fullname_trgm";

-- AlterTable
ALTER TABLE "paths" DROP COLUMN "search_vector_ar",
DROP COLUMN "search_vector_en";
