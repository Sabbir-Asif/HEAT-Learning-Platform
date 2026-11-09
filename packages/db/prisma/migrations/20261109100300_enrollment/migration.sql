-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING_VERIFICATION', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "DecisionAction" AS ENUM ('APPROVE', 'REJECT', 'REMOVE', 'REINSTATE');

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "courseRevisionId" UUID,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "statusBeforeRemoval" "EnrollmentStatus",
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentDecision" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "action" "DecisionAction" NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enrollment_courseId_status_idx" ON "Enrollment"("courseId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_courseRevisionId_idx" ON "Enrollment"("courseRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");

-- CreateIndex
CREATE INDEX "EnrollmentDecision_enrollmentId_idx" ON "EnrollmentDecision"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentDecision_adminId_idx" ON "EnrollmentDecision"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRevision_courseId_id_key" ON "CourseRevision"("courseId", "id");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_courseRevisionId_fkey" FOREIGN KEY ("courseId", "courseRevisionId") REFERENCES "CourseRevision"("courseId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentDecision" ADD CONSTRAINT "EnrollmentDecision_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentDecision" ADD CONSTRAINT "EnrollmentDecision_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddCheckConstraint
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_pinned_revision_check" CHECK ("status" NOT IN ('APPROVED', 'COMPLETED') OR "courseRevisionId" IS NOT NULL);

-- AddCheckConstraint
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_removal_state_check" CHECK (("status" = 'REMOVED') = ("statusBeforeRemoval" IS NOT NULL));
