-- AlterTable
ALTER TABLE "lesson_progress" ADD COLUMN     "warmUpCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "completionXpAward" INTEGER NOT NULL DEFAULT 10;