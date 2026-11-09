CREATE TYPE "ModuleProgressStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'QUIZ_READY', 'COMPLETED');

CREATE TABLE "PlaybackSession" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlaybackSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoProgress" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "watchedIntervals" JSONB NOT NULL DEFAULT '[]',
    "coverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resumePositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "firstWatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModuleProgress" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "status" "ModuleProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "unlockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "quizReadyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModuleProgress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlaybackSession_enrollmentId_videoId_idx" ON "PlaybackSession"("enrollmentId", "videoId");

CREATE INDEX "PlaybackSession_videoId_idx" ON "PlaybackSession"("videoId");

CREATE INDEX "VideoProgress_videoId_idx" ON "VideoProgress"("videoId");

CREATE UNIQUE INDEX "VideoProgress_enrollmentId_videoId_key" ON "VideoProgress"("enrollmentId", "videoId");

CREATE INDEX "ModuleProgress_moduleId_status_idx" ON "ModuleProgress"("moduleId", "status");

CREATE UNIQUE INDEX "ModuleProgress_enrollmentId_moduleId_key" ON "ModuleProgress"("enrollmentId", "moduleId");

ALTER TABLE "PlaybackSession" ADD CONSTRAINT "PlaybackSession_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlaybackSession" ADD CONSTRAINT "PlaybackSession_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModuleProgress" ADD CONSTRAINT "ModuleProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModuleProgress" ADD CONSTRAINT "ModuleProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_coverage_check" CHECK ("coverage" >= 0 AND "coverage" <= 1);

ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_resumePositionSeconds_check" CHECK ("resumePositionSeconds" >= 0);

ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_lastSequence_check" CHECK ("lastSequence" >= 0);
