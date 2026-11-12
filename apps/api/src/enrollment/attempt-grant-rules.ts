import { ApiException } from "../http/api-exception";
import { submissionEligibility } from "../learning/quiz-submission-rules";
import type { SubmissionFacts } from "../learning/quiz-submission-rules";
import type { EnrollmentStatusName } from "./approval-rules";

export interface AttemptGrantFacts extends SubmissionFacts {
  enrollmentStatus: EnrollmentStatusName;
}

export const attemptGrantRefusal = (facts: AttemptGrantFacts, now: Date): ApiException | null => {
  if (facts.enrollmentStatus !== "APPROVED") {
    return new ApiException(409, "ENROLLMENT_NOT_ACTIVE");
  }
  if (facts.attemptLimit === null) return new ApiException(409, "QUIZ_ATTEMPTS_UNLIMITED");
  return submissionEligibility(facts, now).kind === "LIMIT_REACHED"
    ? null
    : new ApiException(409, "QUIZ_GRANT_NOT_NEEDED");
};

export const canGrantAttempt = (facts: AttemptGrantFacts, now: Date): boolean =>
  attemptGrantRefusal(facts, now) === null;
