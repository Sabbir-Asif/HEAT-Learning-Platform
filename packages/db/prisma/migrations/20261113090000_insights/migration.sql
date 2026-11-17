CREATE TYPE "InsightRollupKind" AS ENUM ('ENROLLMENT', 'MODULE', 'QUIZ', 'QUESTION');

CREATE TYPE "InsightRunTrigger" AS ENUM ('NIGHTLY', 'MANUAL', 'BACKFILL');

CREATE TYPE "InsightRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "InsightRollup" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "kind" "InsightRollupKind" NOT NULL,
    "key" TEXT NOT NULL,
    "courseId" UUID NOT NULL,
    "moduleId" UUID,
    "questionId" UUID,
    "universityId" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "session" TEXT NOT NULL,
    "registered" INTEGER NOT NULL DEFAULT 0,
    "verified" INTEGER NOT NULL DEFAULT 0,
    "approved" INTEGER NOT NULL DEFAULT 0,
    "started" INTEGER NOT NULL DEFAULT 0,
    "quizReady" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "passedAttempts" INTEGER NOT NULL DEFAULT 0,
    "attemptedStudents" INTEGER NOT NULL DEFAULT 0,
    "passedStudents" INTEGER NOT NULL DEFAULT 0,
    "answered" INTEGER NOT NULL DEFAULT 0,
    "missed" INTEGER NOT NULL DEFAULT 0,
    "askedStudents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightRollup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsightRun" (
    "id" UUID NOT NULL,
    "trigger" "InsightRunTrigger" NOT NULL,
    "status" "InsightRunStatus" NOT NULL DEFAULT 'PENDING',
    "fromDay" DATE NOT NULL,
    "toDay" DATE NOT NULL,
    "requestedById" UUID,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InsightRollup_kind_day_idx" ON "InsightRollup"("kind", "day");

CREATE INDEX "InsightRollup_courseId_day_idx" ON "InsightRollup"("courseId", "day");

CREATE UNIQUE INDEX "InsightRollup_day_key_key" ON "InsightRollup"("day", "key");

CREATE INDEX "InsightRun_status_idx" ON "InsightRun"("status");

CREATE INDEX "InsightRun_trigger_requestedAt_idx" ON "InsightRun"("trigger", "requestedAt");

CREATE INDEX "InsightRun_finishedAt_idx" ON "InsightRun"("finishedAt");

