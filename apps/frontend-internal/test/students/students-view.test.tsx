import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StudentsView } from "../../src/students/students-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const row = {
  id: "0198f1a0-0000-7000-8000-000000000001",
  status: "APPROVED",
  requestedAt: "2026-11-01T04:00:00.000Z",
  student: {
    userId: "0198f1a0-0000-7000-8000-0000000000e1",
    name: "Anne Smith",
    email: "anne@example.com",
  },
  course: { id: "0198f1a0-0000-7000-8000-0000000000c1", title: "HEAT" },
  university: { id: "0198f1a0-0000-7000-8000-0000000000a1", name: "University of Dhaka" },
  faculty: { id: "0198f1a0-0000-7000-8000-0000000000f1", name: "Faculty of Arts" },
  department: { id: "0198f1a0-0000-7000-8000-0000000000d1", name: "Anthropology" },
  session: "2020-21",
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const empty = () => json({ items: [], total: 0, page: 1, pageSize: 50 });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) =>
    String(input).includes("/admin/students")
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
          <StudentsView />
        </QueryClientProvider>
      </NuqsTestingAdapter>,
    ),
  );
  return container;
}

const listCall = () =>
  fetchMock.mock.calls
    .map((call) => String(call[0]))
    .find((url) => url.includes("/admin/students"));

describe("StudentsView", () => {
  test("lists students by name with their status", async () => {
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Anne Smith"));
    expect(view.textContent).toContain("anne@example.com");
    expect(view.textContent).toContain("Anthropology");
    expect(view.textContent).toContain("Approved");
    expect(listCall()).toContain("sort=name");
  });

  test("filters held in the URL are restored on load and sent to the API", async () => {
    await mount(
      "?university=0198f1a0-0000-7000-8000-0000000000a1&session=2020-21&status=APPROVED&q=anne",
    );
    await vi.waitFor(() => expect(listCall()).toBeDefined());

    const url = listCall() ?? "";
    expect(url).toContain("universityId=0198f1a0-0000-7000-8000-0000000000a1");
    expect(url).toContain("session=2020-21");
    expect(url).toContain("status=APPROVED");
    expect(url).toContain("q=anne");
  });

  test("an unknown status in the URL is dropped before it reaches the API", async () => {
    await mount("?status=ACTIVE");
    await vi.waitFor(() => expect(listCall()).toBeDefined());

    expect(listCall()).not.toContain("status=");
  });

  test("shows the shared empty state when nothing matches", async () => {
    fetchMock.mockImplementation(async () => empty());
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("No students found"));
  });
});
