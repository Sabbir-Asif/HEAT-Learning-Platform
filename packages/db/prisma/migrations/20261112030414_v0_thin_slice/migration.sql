-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "fileSizeBytes" INTEGER,
ALTER COLUMN "fileKey" DROP NOT NULL,
ALTER COLUMN "fileSha256" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlaybackSession" ADD COLUMN     "acceptedSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lastSequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "assetId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VideoAsset" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "rejectionReason" TEXT;
