CREATE TYPE "EmailCategory" AS ENUM ('VERIFICATION', 'PASSWORD', 'ENROLLMENT', 'CERTIFICATE');

CREATE TYPE "EmailJobStatus" AS ENUM ('QUEUED', 'DELAYED', 'SENDING', 'SENT', 'FAILED');

CREATE TYPE "NotificationType" AS ENUM ('ENROLLMENT_APPROVED', 'ENROLLMENT_REJECTED', 'ENROLLMENT_REMOVED', 'ENROLLMENT_REINSTATED', 'CERTIFICATE_READY', 'NEWS_PUBLISHED');

CREATE TABLE "Outbox" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailJob" (
    "id" UUID NOT NULL,
    "outboxId" UUID,
    "userId" UUID,
    "recipientAddress" TEXT NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "template" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "EmailJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "smtpResponse" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Outbox_processedAt_createdAt_idx" ON "Outbox"("processedAt", "createdAt");

CREATE INDEX "EmailJob_status_category_idx" ON "EmailJob"("status", "category");

CREATE INDEX "EmailJob_userId_idx" ON "EmailJob"("userId");

CREATE INDEX "EmailJob_outboxId_idx" ON "EmailJob"("outboxId");

CREATE INDEX "EmailJob_sentAt_idx" ON "EmailJob"("sentAt");

CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "Outbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_attempts_check" CHECK ("attempts" >= 0);
