CREATE INDEX "Enrollment_status_requestedAt_idx" ON "Enrollment"("status", "requestedAt");
CREATE INDEX "StudentProfile_departmentId_session_idx" ON "StudentProfile"("departmentId", "session");
