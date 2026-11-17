import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { OverviewView } from "../../src/overview/overview-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const overview = (overrides: Record<string, unknown> = {}) => ({
  statusCounts: [
    { status: "PENDING_VERIFICATION", count: 1 },
    { status: "PENDING_APPROVAL", count: 3 },
    { status: "APPROVED", count: 12 },
  ],
  totalEnrollments: 16,
  pending: { count: 3, oldestRequestedAt: "2026-11-15T06:00:00.000Z", oldestAgeSeconds: 172800 },
  certificatesIssued: 4,
  passRates: [
    { moduleId: "m1", label: "Module 1", suppressed: false, students: 20, passRate: 85.5 },
    { moduleId: "m2", label: "Module 2", suppressed: true, students: null, passRate: null },
  ],
  suppressionThreshold: 5,
  refreshedAt: "2026-11-16T20:30:00.000Z",
  ...overrides,
});

const courses = (count: number) => ({
  items: Array.from({ length: count }, (_, index) => ({
    id: `0198f1a0-0000-7000-8000-00000000000${index + 1}`,
    title: `Course ${index + 1}`,
  })),
  total: count,
  page: 1,
  pageSize: 50,
});

const serve = (options: { courseCount: number; overview?: unknown; failOverview?: boolean }) =>
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/admin/overview")) {
      return options.failOverview
        ? new Response("{}", { status: 500 })
        : json(options.overview ?? overview());
    }
    return json(courses(options.courseCount));
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  }));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

async function mount(searchParams = "") {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root?.render(
      <NuqsTestingAdapter searchParams={searchParams}>
        <QueryClientProvider client={client}>
          <OverviewView />
        </QueryClientProvider>
      </NuqsTestingAdapter>,
    ),
  );
  return container;
}

describe("OverviewView", () => {
  test("shows the pending count, the oldest age and a link to the queue oldest first", async () => {
    serve({ courseCount: 1 });
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Awaiting approval"));
    expect(view.textContent).toContain("2 days");
    expect(view.textContent).toContain("Certificates issued");
    const link = view.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/enrollments?sort=requestedAt");
  });

  test("shows the as of time in Asia/Dhaka and explains the withheld module", async () => {
    serve({ courseCount: 1 });
    const view = await mount();
    await vi.waitFor(() =>
      expect(view.textContent).toContain("Pass rates as of 17 Nov 2026, 02:30 (Asia/Dhaka)."),
    );
    expect(view.textContent).toContain(
      "Not shown because fewer than 5 students took the quiz: Module 2.",
    );
  });

  test("hides the course selector for one course and shows it for several", async () => {
    serve({ courseCount: 1 });
    let view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Awaiting approval"));
    expect(view.textContent).not.toContain("All courses");
    await act(async () => root?.unmount());
    view.remove();

    serve({ courseCount: 2 });
    view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("All courses"));
  });

  test("sends the chosen course and keeps it on the queue link", async () => {
    serve({ courseCount: 2 });
    const courseId = "0198f1a0-0000-7000-8000-000000000001";
    const view = await mount(`?course=${courseId}`);
    await vi.waitFor(() => expect(view.querySelector("a")).not.toBeNull());
    expect(view.querySelector("a")?.getAttribute("href")).toBe(
      `/enrollments?sort=requestedAt&course=${courseId}`,
    );
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes(`courseId=${courseId}`)),
    ).toBe(true);
  });

  test("shows empty states when there is no data yet", async () => {
    serve({
      courseCount: 1,
      overview: overview({
        statusCounts: [],
        totalEnrollments: 0,
        pending: { count: 0, oldestRequestedAt: null, oldestAgeSeconds: null },
        certificatesIssued: 0,
        passRates: [],
        refreshedAt: null,
      }),
    });
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("None waiting"));
    expect(view.querySelectorAll('[data-slot="empty-state"]')).toHaveLength(2);
    expect(view.textContent).toContain("not available yet");
  });

  test("shows an error with a retry when the overview fails", async () => {
    serve({ courseCount: 1, failOverview: true });
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("could not be loaded"));
    expect(view.querySelector('[role="alert"]')).not.toBeNull();
  });
});
