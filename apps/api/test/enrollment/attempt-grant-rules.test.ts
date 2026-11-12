import { describe, expect, test } from "vitest";
import { attemptGrantRefusal, canGrantAttempt } from "../../src/enrollment/attempt-grant-rules";
import type { AttemptGrantFacts } from "../../src/enrollment/attempt-grant-rules";

const now = new Date("2026-11-12T10:00:00.000Z");
const attempt = (passed: boolean | null, submittedAt = "2026-11-12T09:00:00.000Z") => ({
  passed,
  submittedAt: new Date(submittedAt),
});

const facts = (overrides: Partial<AttemptGrantFacts> = {}): AttemptGrantFacts => ({
  enrollmentStatus: "APPROVED",
  attemptLimit: 2,
  extraAttempts: 0,
  waitMinutes: 10,
  attempts: [attempt(false), attempt(false)],
  ...overrides,
});

describe("attemptGrantRefusal", () => {
  test("allows a grant once the limit is used up", () => {
    expect(attemptGrantRefusal(facts(), now)).toBeNull();
    expect(canGrantAttempt(facts(), now)).toBe(true);
  });

  test("allows a grant when the wait time from the last attempt is still running", () => {
    const recent = facts({
      attempts: [attempt(false), attempt(false, "2026-11-12T09:59:00.000Z")],
    });

    expect(attemptGrantRefusal(recent, now)).toBeNull();
  });

  test("allows another grant once earlier grants are used up too", () => {
    const used = facts({
      extraAttempts: 1,
      attempts: [attempt(false), attempt(false), attempt(false)],
    });

    expect(attemptGrantRefusal(used, now)).toBeNull();
  });

  test.each(["PENDING_APPROVAL", "COMPLETED", "REMOVED", "REJECTED"] as const)(
    "refuses an enrollment in %s",
    (enrollmentStatus) => {
      const refusal = attemptGrantRefusal(facts({ enrollmentStatus }), now);

      expect(refusal).toMatchObject({ code: "ENROLLMENT_NOT_ACTIVE" });
      expect(refusal?.getStatus()).toBe(409);
    },
  );

  test("refuses a quiz with unlimited attempts", () => {
    const refusal = attemptGrantRefusal(facts({ attemptLimit: null }), now);

    expect(refusal).toMatchObject({ code: "QUIZ_ATTEMPTS_UNLIMITED" });
    expect(canGrantAttempt(facts({ attemptLimit: null }), now)).toBe(false);
  });

  test("refuses while attempts remain", () => {
    expect(attemptGrantRefusal(facts({ attempts: [attempt(false)] }), now)).toMatchObject({
      code: "QUIZ_GRANT_NOT_NEEDED",
    });
  });

  test("refuses an unused grant so grants cannot stack", () => {
    expect(attemptGrantRefusal(facts({ extraAttempts: 1 }), now)).toMatchObject({
      code: "QUIZ_GRANT_NOT_NEEDED",
    });
  });

  test("refuses a student who already passed", () => {
    const passed = facts({ attempts: [attempt(false), attempt(true)] });

    expect(attemptGrantRefusal(passed, now)).toMatchObject({ code: "QUIZ_GRANT_NOT_NEEDED" });
  });
});
