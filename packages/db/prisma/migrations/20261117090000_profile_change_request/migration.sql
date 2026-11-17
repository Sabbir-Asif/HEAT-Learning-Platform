ALTER TYPE "NotificationType" ADD VALUE 'PROFILE_CHANGE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PROFILE_CHANGE_REJECTED';

ALTER TABLE "ProfileChangeRequest" ADD COLUMN "note" TEXT;

CREATE UNIQUE INDEX "ProfileChangeRequest_one_pending_per_user_key" ON "ProfileChangeRequest" ("userId") WHERE "status" = 'PENDING';
