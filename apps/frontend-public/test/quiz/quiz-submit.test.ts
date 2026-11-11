import { ApiError } from "@heat/api-client";
import { describe, expect, test, vi } from "vitest";
import { createQuizSubmit, outcomeOfSubmitError } from "../../src/quiz/quiz-submit";

const attemptId = "6f2d1c1e-0a53-4d0e-9f0b-1d3b7a4c1111";
const answers = { q1: "o1" };
const response = {
  attemptId,
  scorePercent: 80,
  passed: true,
  passMarkPercent: 70,
  correctCount: 4,
  totalQuestions: 5,
};

const build = (send: ReturnType<typeof vi.fn>) => {
  const onSubmitted = vi.fn();
  return { submit: createQuizSubmit({ send, onSubmitted }), onSubmitted };
};

describe("createQuizSubmit", () => {
  test("sends the attempt id as the idempotency key and reports the submitted attempt", async () => {
    const send = vi.fn().mockResolvedValue(response);
    const { submit, onSubmitted } = build(send);
    await expect(submit({ attemptId, answers })).resolves.toEqual({
      status: "SUBMITTED",
      attemptId,
    });
    expect(send).toHaveBeenCalledWith({ attemptId, idempotencyKey: attemptId, answers });
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  test("a retry after a failure reuses the same idempotency key", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 0, code: "NETWORK_ERROR" }))
      .mockResolvedValueOnce(response);
    const { submit } = build(send);
    await expect(submit({ attemptId, answers })).resolves.toEqual({ status: "FAILED" });
    await submit({ attemptId, answers });
    const keys = send.mock.calls.map(
      ([request]) => (request as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys).toEqual([attemptId, attemptId]);
  });

  test("does not refresh anything when the submission fails", async () => {
    const send = vi.fn().mockRejectedValue(new Error("boom"));
    const { submit, onSubmitted } = build(send);
    await expect(submit({ attemptId, answers })).resolves.toEqual({ status: "FAILED" });
    expect(onSubmitted).not.toHaveBeenCalled();
  });
});

describe("outcomeOfSubmitError", () => {
  const apiError = (code: ApiError["code"], details?: ApiError["details"]) =>
    new ApiError({ status: 409, code, details });

  test("a wait refusal carries the next attempt time", () => {
    expect(
      outcomeOfSubmitError(
        apiError("QUIZ_ATTEMPT_WAIT", { nextAttemptAt: "2026-11-12T10:05:00.000Z" }),
      ),
    ).toEqual({ status: "WAITING", nextAttemptAt: "2026-11-12T10:05:00.000Z" });
  });

  test("a wait refusal without details has no time", () => {
    expect(outcomeOfSubmitError(apiError("QUIZ_ATTEMPT_WAIT"))).toEqual({
      status: "WAITING",
      nextAttemptAt: null,
    });
  });

  test("the limit refusal is exhausted", () => {
    expect(outcomeOfSubmitError(apiError("QUIZ_ATTEMPT_LIMIT_REACHED"))).toEqual({
      status: "EXHAUSTED",
    });
  });

  test.each([
    "QUIZ_ATTEMPT_NOT_OPEN",
    "QUIZ_ANSWER_INVALID",
    "QUIZ_NOT_UNLOCKED",
    "ENROLLMENT_NOT_ACTIVE",
    "NOT_FOUND",
  ] as const)("%s closes the attempt", (code) => {
    expect(outcomeOfSubmitError(apiError(code))).toEqual({ status: "CLOSED" });
  });

  test("other errors are a failure to retry", () => {
    expect(outcomeOfSubmitError(apiError("RATE_LIMITED"))).toEqual({ status: "FAILED" });
    expect(outcomeOfSubmitError("nope")).toEqual({ status: "FAILED" });
  });
});
