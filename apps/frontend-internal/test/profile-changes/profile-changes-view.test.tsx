import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ProfileChangesView } from "../../src/profile-changes/profile-changes-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const named = (name: string) => ({ id: "0198f1a0-0000-7000-8000-0000000000a1", name });

const item = {
  id: "0198f1a0-0000-7000-8000-000000000001",
  status: "PENDING",
  requested: {
    name: "Anne Jones",
    university: null,
    faculty: null,
    department: null,
    session: null,
  },
  note: "Married name",
  reason: null,
  createdAt: "2026-11-17T04:00:00.000Z",
  decidedAt: null,
  student: { name: "Anne Smith", email: "anne@example.test" },
  current: {
    name: "Anne Smith",
    university: named("University of Dhaka"),
    faculty: named("Science"),
    department: named("Physics"),
    session: "2020-21",
  },
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () =>
    json({ items: [item], total: 1, page: 1, pageSize: 25 }),
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
          <ProfileChangesView />
        </QueryClientProvider>
      </NuqsTestingAdapter>,
    ),
  );
  return container;
}

const buttonLabelled = (view: HTMLElement, label: string) =>
  [...view.querySelectorAll("button")].find((button) => button.textContent?.trim() === label);

describe("ProfileChangesView", () => {
  test("asks the API for waiting requests and offers approve and reject", async () => {
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Anne Smith"));

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("status=PENDING");
    expect(view.textContent).toContain("Name: Anne Smith to Anne Jones");
    expect(view.textContent).toContain("Married name");
    expect(buttonLabelled(view, "Approve")).toBeDefined();
    expect(buttonLabelled(view, "Reject")).toBeDefined();
  });

  test("a decided list shows the rejection reason and no actions", async () => {
    fetchMock.mockImplementation(async () =>
      json({
        items: [{ ...item, status: "REJECTED", reason: "Does not match records" }],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    );
    const view = await mount("?status=rejected");
    await vi.waitFor(() => expect(view.textContent).toContain("Anne Smith"));

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("status=REJECTED");
    expect(view.textContent).toContain("Rejected: Does not match records");
    expect(buttonLabelled(view, "Approve")).toBeUndefined();
  });

  test("shows an empty state when nothing is waiting", async () => {
    fetchMock.mockImplementation(async () => json({ items: [], total: 0, page: 1, pageSize: 25 }));
    const view = await mount();

    await vi.waitFor(() => expect(view.textContent).toContain("No change requests waiting"));
  });

  test("approve opens a sheet that summarises the change before applying it", async () => {
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Anne Smith"));

    await act(async () => buttonLabelled(view, "Approve")?.click());

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Existing certificates keep the name"),
    );
    expect(buttonLabelled(document.body, "Approve request")).toBeDefined();
  });

  test("reject asks for a reason before it sends anything", async () => {
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Anne Smith"));

    await act(async () => buttonLabelled(view, "Reject")?.click());
    await vi.waitFor(() => expect(buttonLabelled(document.body, "Reject request")).toBeDefined());
    const callsBefore = fetchMock.mock.calls.length;
    await act(async () => buttonLabelled(document.body, "Reject request")?.click());

    await vi.waitFor(() => expect(document.body.textContent).toContain("Give a reason"));
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});
