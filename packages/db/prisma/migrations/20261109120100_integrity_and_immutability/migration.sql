ALTER TABLE "QuizAttempt"
  ADD CONSTRAINT "QuizAttempt_scored_submitted_check"
  CHECK ("scorePercent" IS NULL OR "submittedAt" IS NOT NULL);

ALTER TABLE "QuizAttempt"
  ADD CONSTRAINT "QuizAttempt_passed_scored_check"
  CHECK ("passed" IS NULL OR "scorePercent" IS NOT NULL);

ALTER TABLE "QuizAttempt"
  ADD CONSTRAINT "QuizAttempt_passed_matches_score_check"
  CHECK ("scorePercent" IS NULL OR "passed" IS NULL OR "passed" = ("scorePercent" >= "passMarkSnapshot"));

CREATE FUNCTION "quiz_attempt_freeze_submitted"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."submittedAt" IS NOT NULL AND (
    NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
    OR NEW."scorePercent" IS DISTINCT FROM OLD."scorePercent"
    OR NEW."passed" IS DISTINCT FROM OLD."passed"
    OR NEW."passMarkSnapshot" IS DISTINCT FROM OLD."passMarkSnapshot"
    OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
    OR NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId"
    OR NEW."quizId" IS DISTINCT FROM OLD."quizId"
  ) THEN
    RAISE EXCEPTION 'a submitted attempt cannot be changed';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "QuizAttempt_freeze_submitted"
BEFORE UPDATE ON "QuizAttempt"
FOR EACH ROW EXECUTE FUNCTION "quiz_attempt_freeze_submitted"();

CREATE FUNCTION "answer_freeze_submitted"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "QuizAttempt"
    WHERE "id" = OLD."attemptId" AND "submittedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'answers of a submitted attempt cannot be changed';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "Answer_freeze_submitted"
BEFORE UPDATE OR DELETE ON "Answer"
FOR EACH ROW EXECUTE FUNCTION "answer_freeze_submitted"();

CREATE FUNCTION "certificate_freeze_issued"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."number" IS DISTINCT FROM OLD."number"
    OR NEW."recipientName" IS DISTINCT FROM OLD."recipientName"
    OR NEW."fileKey" IS DISTINCT FROM OLD."fileKey"
    OR NEW."fileSha256" IS DISTINCT FROM OLD."fileSha256"
  THEN
    RAISE EXCEPTION 'an issued certificate cannot be changed except to revoke it';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "Certificate_freeze_issued"
BEFORE UPDATE ON "Certificate"
FOR EACH ROW EXECUTE FUNCTION "certificate_freeze_issued"();
