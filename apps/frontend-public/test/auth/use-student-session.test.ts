import { ApiError } from "@heat/api-client";
import { beforeEach, describe, expect, test, vi } from "vitest";

const meDescribe = vi.fn();
const studentAuthRefresh = vi.fn();

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  meDescribe: () => meDescribe(),
  studentAuthRefresh: () => studentAuthRefresh(),
}));

const { readStudentSession } = await import("../../src/auth/use-student-session");

const unauthorized = () => new ApiError({ status: 401, code: "UNAUTHENTICATED" });
const session = { user: { id: "u" }, enrollments: [] };

beforeEach(() => {
  meDescribe.mockReset();
  studentAuthRefresh.mockReset();
});

describe("readStudentSession", () => {
  test("returns the session without refreshing when the access token is valid", async () => {
    meDescribe.mockResolvedValueOnce(session);

    expect(await readStudentSession()).toBe(session);
    expect(studentAuthRefresh).not.toHaveBeenCalled();
  });

  test("refreshes once after a 401 and reads the session again", async () => {
    meDescribe.mockRejectedValueOnce(unauthorized()).mockResolvedValueOnce(session);
    studentAuthRefresh.mockResolvedValueOnce(undefined);

    expect(await readStudentSession()).toBe(session);
    expect(studentAuthRefresh).toHaveBeenCalledTimes(1);
  });

  test("is anonymous when the refresh is refused", async () => {
    meDescribe.mockRejectedValueOnce(unauthorized());
    studentAuthRefresh.mockRejectedValueOnce(unauthorized());

    expect(await readStudentSession()).toBeNull();
  });

  test("rethrows errors other than 401", async () => {
    meDescribe.mockRejectedValueOnce(new ApiError({ status: 500, code: "INTERNAL" }));

    await expect(readStudentSession()).rejects.toMatchObject({ status: 500 });
    expect(studentAuthRefresh).not.toHaveBeenCalled();
  });
});
