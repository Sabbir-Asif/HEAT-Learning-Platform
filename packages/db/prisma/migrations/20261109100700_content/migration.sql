CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'DOCUMENT');

CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PROTECTED', 'PRIVATE');

CREATE TYPE "ResourceKind" AS ENUM ('FILE', 'LINK');

CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT NOT NULL,
    "variants" JSONB NOT NULL DEFAULT '[]',
    "uploaderId" UUID NOT NULL,
    "altText" TEXT,
    "linkedEntity" TEXT,
    "linkedId" UUID,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Resource" (
    "id" UUID NOT NULL,
    "courseId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ResourceKind" NOT NULL,
    "url" TEXT,
    "mediaAssetId" UUID,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NewsPost" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_key_key" ON "MediaAsset"("key");

CREATE INDEX "MediaAsset_uploaderId_idx" ON "MediaAsset"("uploaderId");

CREATE INDEX "MediaAsset_linkedEntity_linkedId_idx" ON "MediaAsset"("linkedEntity", "linkedId");

CREATE INDEX "Resource_courseId_idx" ON "Resource"("courseId");

CREATE INDEX "Resource_mediaAssetId_idx" ON "Resource"("mediaAssetId");

CREATE UNIQUE INDEX "NewsPost_slug_key" ON "NewsPost"("slug");

CREATE INDEX "NewsPost_authorId_idx" ON "NewsPost"("authorId");

CREATE INDEX "NewsPost_publishedAt_idx" ON "NewsPost"("publishedAt");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Resource" ADD CONSTRAINT "Resource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Resource" ADD CONSTRAINT "Resource_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_sha256_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_sizeBytes_check" CHECK ("sizeBytes" > 0);

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_dimensions_check" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0));

ALTER TABLE "Resource" ADD CONSTRAINT "Resource_kind_target_check" CHECK (("kind" = 'FILE' AND "mediaAssetId" IS NOT NULL AND "url" IS NULL) OR ("kind" = 'LINK' AND "url" IS NOT NULL AND "mediaAssetId" IS NULL));
