import type { MeEnrollment } from "@heat/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { AwaitingApprovalView } from "../../src/awaiting/awaiting-approval-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLElement | undefined;

const enrollment = (status: MeEnrollment["status"], reason?: string): MeEnrollment => ({
  courseId: "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6b",
  courseSlug: "gender-safety",
  courseTitle: "Gender Safety",
  status,
  reason,
});

async function mount(element: React.ReactElement) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(element));
  return container;
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe("AwaitingApprovalView", () => {
  test("shows the status of a pending approval request without a course link", async () => {
    const view = await mount(
      <AwaitingApprovalView enrollments={[enrollment("PENDING_APPROVAL")]} emailVerified />,
    );

    expect(view.textContent).toContain("Gender Safety");
    expect(view.textContent).toContain("Pending approval");
    expect(view.querySelector('a[href^="/learn"]')).toBeNull();
  });

  test("links to the profile", async () => {
    const view = await mount(
      <AwaitingApprovalView enrollments={[enrollment("PENDING_APPROVAL")]} emailVerified />,
    );

    expect(view.querySelector('a[href="/profile"]')).not.toBeNull();
  });

  test("shows the resend slot only for an unverified pending verification request", async () => {
    const slot = <button type="button">Resend email</button>;
    const pending = await mount(
      <AwaitingApprovalView
        enrollments={[enrollment("PENDING_VERIFICATION")]}
        emailVerified={false}
        resendVerification={slot}
      />,
    );
    expect(pending.textContent).toContain("Pending verification");
    expect(pending.textContent).toContain("Resend email");
    await act(async () => root?.unmount());
    container?.remove();

    const verified = await mount(
      <AwaitingApprovalView
        enrollments={[enrollment("PENDING_APPROVAL")]}
        emailVerified
        resendVerification={slot}
      />,
    );
    expect(verified.textContent).not.toContain("Resend email");
  });

  test.each(["APPROVED", "COMPLETED"] as const)("links %s into the course", async (status) => {
    const view = await mount(
      <AwaitingApprovalView enrollments={[enrollment(status)]} emailVerified />,
    );

    expect(view.querySelector('a[href="/learn/gender-safety"]')?.textContent).toBe("Open course");
  });

  test("shows the removal reason and no course link for a removed enrollment", async () => {
    const view = await mount(
      <AwaitingApprovalView
        enrollments={[enrollment("REMOVED", "Left the university")]}
        emailVerified
      />,
    );

    expect(view.textContent).toContain("Removed");
    expect(view.textContent).toContain("Left the university");
    expect(view.querySelector('a[href^="/learn"]')).toBeNull();
  });

  test("shows the reason for a rejected request", async () => {
    const view = await mount(
      <AwaitingApprovalView
        enrollments={[enrollment("REJECTED", "Not a student")]}
        emailVerified
      />,
    );

    expect(view.textContent).toContain("Not a student");
  });

  test("shows an empty state with a link to the courses", async () => {
    const view = await mount(<AwaitingApprovalView enrollments={[]} emailVerified />);

    expect(view.textContent).toContain("You have no enrollment requests");
    expect(view.querySelector('a[href="/courses"]')).not.toBeNull();
  });
});
