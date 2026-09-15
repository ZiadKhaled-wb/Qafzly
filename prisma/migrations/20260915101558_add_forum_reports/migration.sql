-- CreateTable
CREATE TABLE "forum_reports" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_reports_status_idx" ON "forum_reports"("status");

-- CreateIndex
CREATE INDEX "forum_reports_postId_idx" ON "forum_reports"("postId");

-- CreateIndex
CREATE INDEX "forum_reports_commentId_idx" ON "forum_reports"("commentId");

-- CreateIndex
CREATE INDEX "forum_reports_reporterId_idx" ON "forum_reports"("reporterId");

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "forum_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
