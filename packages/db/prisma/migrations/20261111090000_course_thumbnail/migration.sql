ALTER TABLE "Course" ADD COLUMN "thumbnailAssetId" UUID;
CREATE INDEX "Course_thumbnailAssetId_idx" ON "Course"("thumbnailAssetId");
ALTER TABLE "Course" ADD CONSTRAINT "Course_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
