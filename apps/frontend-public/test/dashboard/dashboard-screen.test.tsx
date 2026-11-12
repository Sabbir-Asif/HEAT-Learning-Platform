import type { DashboardCourse } from "@heat/contracts";
import { act } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DashboardScreen } from "../../src/dashboard/dashboard-screen";
import { mount } from "../learn/mount";

const useDashboardDescribe = vi.fn();

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useDashboardDescribe: (...args: unknown[]) => useDashboardDescribe(...args),
}));

beforeEach(() => useDashboardDescribe.mockReset());

const id = "0198f1a0-0000-7000-8000-0000000000a1";

const course = (overrides: Partial<DashboardCourse> = {}): DashboardCourse => ({
  courseId: id,
  courseSlug: "heat",
  courseTitle: "HEAT Gender Safety",
  status: "APPROVED",
  reason: null,
  progress: { modulesCompleted: 1, modulesTotal: 4, percent: 25 },
  nextModule: { id, order: 2, title: "Consent", resumeVideoId: id, resumePositionSeconds: 65 },
  certificate: null,
  ...overrides,
});

const ready = (courses: DashboardCourse[]) =>
  useDashboardDescribe.mockReturnValue({ isPending: false, isError: false, data: { courses } });

const link = (view: HTMLElement, text: string) =>
  [...view.querySelectorAll("a")].find((anchor) => anchor.textContent?.includes(text));

describe("DashboardScreen", () => {
  test("continue learning opens the in-progress module with a resume hint", async () => {
    ready([course()]);

    const view = await mount(<DashboardScreen />);

    expect(view.textContent).toContain("1 of 4 modules completed");
    expect(view.textContent).toContain("Module 2: Consent");
    expect(view.textContent).toContain("Resume at 1:05");
    expect(link(view, "Continue learning")?.getAttribute("href")).toBe(`/learn/heat/${id}`);
  });

  test("shows completed and pending courses under their own headings", async () => {
    ready([
      course({
        courseId: "0198f1a0-0000-7000-8000-0000000000a2",
        courseTitle: "Completed course",
        status: "COMPLETED",
        nextModule: null,
        certificate: { id: "0198f1a0-0000-7000-8000-0000000000c1", status: "READY" },
      }),
      course({
        courseId: "0198f1a0-0000-7000-8000-0000000000a3",
        courseTitle: "Pending course",
        status: "PENDING_APPROVAL",
        progress: null,
        nextModule: null,
      }),
    ]);

    const view = await mount(<DashboardScreen />);
    const headings = [...view.querySelectorAll("h2")].map((heading) => heading.textContent);

    expect(headings).toEqual(["Completed", "Waiting for approval"]);
    expect(link(view, "View certificate")?.getAttribute("href")).toBe("/certificates");
    expect(link(view, "Download certificate")?.getAttribute("href")).toBe(
      "/api/certificates/0198f1a0-0000-7000-8000-0000000000c1/download",
    );
    expect(link(view, "Continue learning")).toBeUndefined();
  });

  test("a completed course whose certificate is not ready shows its state without a download", async () => {
    ready([
      course({
        courseTitle: "Held course",
        status: "COMPLETED",
        nextModule: null,
        certificate: { id: null, status: "PENDING" },
      }),
      course({
        courseId: "0198f1a0-0000-7000-8000-0000000000a9",
        courseTitle: "Revoked course",
        status: "COMPLETED",
        nextModule: null,
        certificate: { id: "0198f1a0-0000-7000-8000-0000000000c2", status: "REVOKED" },
      }),
    ]);

    const view = await mount(<DashboardScreen />);

    expect(view.textContent).toContain("Your certificate is being prepared.");
    expect(view.textContent).toContain("This certificate has been revoked.");
    expect(link(view, "Download certificate")).toBeUndefined();
    expect(link(view, "View certificate")).toBeUndefined();
  });

  test("a removed course shows its reason and no continue link", async () => {
    ready([
      course({
        status: "REMOVED",
        reason: "Left the university",
        progress: null,
        nextModule: null,
      }),
    ]);

    const view = await mount(<DashboardScreen />);

    expect(view.textContent).toContain("Reason: Left the university");
    expect(link(view, "Continue learning")).toBeUndefined();
  });

  test("shows the loading state", async () => {
    useDashboardDescribe.mockReturnValue({ isPending: true, isError: false });

    const view = await mount(<DashboardScreen />);

    expect(view.querySelector('[data-slot="dashboard-loading"]')).not.toBeNull();
  });

  test("shows an error with a retry instead of a blank page", async () => {
    const refetch = vi.fn();
    useDashboardDescribe.mockReturnValue({ isPending: false, isError: true, refetch });

    const view = await mount(<DashboardScreen />);
    const retry = [...view.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Retry"),
    );
    await act(async () => retry?.click());

    expect(refetch).toHaveBeenCalled();
  });

  test("shows an empty state when there are no courses", async () => {
    ready([]);

    const view = await mount(<DashboardScreen />);

    expect(view.textContent).toContain("No courses yet");
  });
});
