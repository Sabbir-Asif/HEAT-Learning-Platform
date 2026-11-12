import { ApiError } from "@heat/api-client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount } from "../learn/mount";

const state = vi.fn();
const mutate = vi.fn();
const mutation = { isPending: false, error: null as unknown };

vi.mock("../../src/auth/use-student-session", () => ({ useStudentSession: () => state() }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useSignedInEnrollmentRequest: () => ({ mutate, ...mutation }),
}));

const { CourseEnrollAction, requestFailureMessage } =
  await import("../../src/public-pages/course-enroll-action");

const signedIn = (enrollments: { courseSlug: string; status: string }[], emailVerified = true) => ({
  kind: "signed-in",
  session: { user: { emailVerified }, enrollments },
});

const render = () => mount(<CourseEnrollAction courseSlug="heat" courseTitle="HEAT" />);

beforeEach(() => {
  mutate.mockReset();
  mutation.isPending = false;
  mutation.error = null;
});

describe("CourseEnrollAction", () => {
  test("links anonymous visitors to the enroll page", async () => {
    state.mockReturnValue({ kind: "anonymous" });

    const view = await render();

    expect(view.querySelector("a")?.getAttribute("href")).toBe("/enroll?course=heat");
  });

  test("links to the enroll page while the session is loading", async () => {
    state.mockReturnValue({ kind: "loading" });

    const view = await render();

    expect(view.querySelector("a")?.getAttribute("href")).toBe("/enroll?course=heat");
  });

  test("sends the request for a verified student without an enrollment", async () => {
    state.mockReturnValue(signedIn([]));

    const view = await render();
    view.querySelector("button")?.click();

    expect(view.textContent).toContain("Request to enroll");
    expect(mutate).toHaveBeenCalledWith({ data: { courseSlug: "heat" } }, expect.anything());
  });

  test("asks an unverified student to verify the email instead of offering the request", async () => {
    state.mockReturnValue(signedIn([], false));

    const view = await render();

    expect(view.querySelector("button")).toBeNull();
    expect(view.textContent).toContain("Verify your email address");
  });

  test("shows the current status when an enrollment exists", async () => {
    state.mockReturnValue(signedIn([{ courseSlug: "heat", status: "PENDING_APPROVAL" }]));

    const view = await render();

    expect(view.querySelector("button")).toBeNull();
    expect(view.querySelector('[data-slot="badge"]')).not.toBeNull();
  });

  test("offers to continue learning once access is granted", async () => {
    state.mockReturnValue(signedIn([{ courseSlug: "heat", status: "APPROVED" }]));

    const view = await render();

    expect(view.querySelector("a")?.getAttribute("href")).toBe("/learn/heat");
  });

  test("shows the failure of a request", async () => {
    state.mockReturnValue(signedIn([]));
    mutation.error = new ApiError({ status: 403, code: "EMAIL_NOT_VERIFIED" });

    const view = await render();

    expect(view.querySelector('[role="alert"]')?.textContent).toBe(
      "Verify your email address to request this course.",
    );
  });
});

describe("requestFailureMessage", () => {
  test("falls back to a generic message for unknown failures", () => {
    expect(requestFailureMessage(new Error("x"))).toBe("The request could not be sent. Try again.");
  });
});
