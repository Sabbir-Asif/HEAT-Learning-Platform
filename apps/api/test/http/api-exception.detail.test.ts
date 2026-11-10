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
});
