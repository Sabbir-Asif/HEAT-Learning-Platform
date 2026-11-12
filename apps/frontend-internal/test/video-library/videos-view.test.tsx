import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VideosView } from "../../src/video-library/videos-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const row = {
  id: "0198f1a0-0000-7000-8000-000000000001",
  title: "Welcome",
  status: "FAILED",
  rejectionReason: null,
  failureReason: "TIMED_OUT",
  uploadedAt: "2026-11-11T06:00:00.000Z",
  statusChangedAt: "2026-11-11T06:05:00.000Z",
  course: { id: "0198f1a0-0000-7000-8000-0000000000c1", title: "HEAT" },
  module: { id: "0198f1a0-0000-7000-8000-0000000000c3", title: "Module 1" },
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const empty = () => json({ items: [], total: 0, page: 1, pageSize: 50 });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) =>
    String(input).includes("/admin/videos")
      ? json({ items: [row], total: 1, page: 1, pageSize: 25 })
      : empty(),
  );
  vi.stubGlobal("fetch", fetchMock);
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
          <VideosView />
        </QueryClientProvider>
      </NuqsTestingAdapter>,
    ),
  );
  return container;
}

const listCall = () =>
  fetchMock.mock.calls.map((call) => String(call[0])).find((url) => url.includes("/admin/videos"));

describe("VideosView", () => {
  test("lists videos with their course, status and failure reason", async () => {
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Welcome"));
    expect(view.textContent).toContain("HEAT, Module 1");
    expect(view.textContent).toContain("Failed");
    expect(view.textContent).toContain("it took too long");
    expect(listCall()).toContain("sort=-statusChangedAt");
  });

  test("filters held in the URL are restored on load and sent to the API", async () => {
    await mount("?status=FAILED&course=0198f1a0-0000-7000-8000-0000000000c1&page=2&pageSize=10");
    await vi.waitFor(() => expect(listCall()).toBeDefined());

    const url = listCall() ?? "";
    expect(url).toContain("status=FAILED");
    expect(url).toContain("courseId=0198f1a0-0000-7000-8000-0000000000c1");
    expect(url).toContain("pageSize=10");
  });

  test("a status that is not a video status is dropped before it reaches the API", async () => {
    await mount("?status=ACTIVE");
    await vi.waitFor(() => expect(listCall()).toBeDefined());

    expect(listCall()).not.toContain("status=");
  });

  test("shows the shared empty state when nothing matches", async () => {
    fetchMock.mockImplementation(async () => empty());
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("No videos found"));
  });
});
