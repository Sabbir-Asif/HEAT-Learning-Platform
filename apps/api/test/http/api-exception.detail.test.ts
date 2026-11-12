import type { ArgumentsHost } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { ApiExceptionFilter } from "../../src/http/api-exception.filter";

const reply = (exception: unknown) => {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { setHeader: vi.fn(), status };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: {} }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return { status, json };
};

describe("ApiExceptionFilter with an exception detail", () => {
  test("the detail replaces the catalogue message and the code is kept", () => {
    const { status, json } = reply(
      new ApiException(409, "DIRECTORY_IN_USE", undefined, "Used by 3 students."),
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "DIRECTORY_IN_USE", message: "Used by 3 students." }),
    });
  });

  test("without a detail the catalogue message is used", () => {
    const { json } = reply(new ApiException(409, "DIRECTORY_NAME_TAKEN"));

    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({ message: "A record with this name already exists." }),
    });
  });

  test("field errors on an ApiException reach the response body", () => {
    const { json } = reply(
      new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
        { path: "departmentId", code: "invalid_value" },
      ]),
    );

    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: "VALIDATION_FAILED",
        fields: [{ path: "departmentId", code: "invalid_value" }],
      }),
    });
  });

  test("an archived directory record has its own message", () => {
    const { json } = reply(new ApiException(409, "DIRECTORY_ARCHIVED"));

    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "DIRECTORY_ARCHIVED" }),
    });
  });

  test("failures on an ApiException reach the response body", () => {
    const { json } = reply(
      new ApiException(422, "COURSE_PUBLISH_CHECKS_FAILED", undefined, undefined, undefined, [
        "Module 1 has no ready video.",
      ]),
    );

    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({ failures: ["Module 1 has no ready video."] }),
    });
  });
});

describe("ApiExceptionFilter with exception details", () => {
  test("the details are returned beside the code", () => {
    const { status, json } = reply(
      new ApiException(409, "QUIZ_ATTEMPT_WAIT", 30, undefined, undefined, undefined, {
        nextAttemptAt: "2026-11-12T10:05:00.000Z",
      }),
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: "QUIZ_ATTEMPT_WAIT",
        details: { nextAttemptAt: "2026-11-12T10:05:00.000Z" },
      }),
    });
  });
});
