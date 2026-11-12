ALTER TABLE "Resource" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Resource_published_displayOrder_idx" ON "Resource"("published", "displayOrder");
