import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount } from "../learn/mount";

const state = vi.fn();
const replace = vi.fn();

vi.mock("../../src/auth/use-student-session", () => ({ useStudentSession: () => state() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../../src/enroll/enroll-wizard", () => ({
  EnrollWizard: ({ courseSlug }: { courseSlug: string }) => <form data-course={courseSlug} />,
}));

const { EnrollGate } = await import("../../src/enroll/enroll-gate");

beforeEach(() => replace.mockReset());

describe("EnrollGate", () => {
  test("shows the registration form to an anonymous visitor", async () => {
    state.mockReturnValue({ kind: "anonymous" });

    const view = await mount(<EnrollGate courseSlug="heat" />);

    expect(view.querySelector("form")?.getAttribute("data-course")).toBe("heat");
    expect(replace).not.toHaveBeenCalled();
  });

  test("sends a signed-in student to the course page without showing the form", async () => {
    state.mockReturnValue({ kind: "signed-in", session: {} });

    const view = await mount(<EnrollGate courseSlug="heat" />);

    expect(view.querySelector("form")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/courses/heat");
  });

  test("shows neither the form nor a redirect while the session loads", async () => {
    state.mockReturnValue({ kind: "loading" });

    const view = await mount(<EnrollGate courseSlug="heat" />);

    expect(view.querySelector("form")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});
