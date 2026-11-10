import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuditLogView } from "../../src/audit/audit-log-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const entry = {
  id: "0198f1a0-0000-7000-8000-000000000001",
  occurredAt: "2026-11-01T04:00:00.000Z",
  actorId: "0198f1a0-0000-7000-8000-0000000000aa",
  actorEmail: "root@example.test",
  action: "admin.deactivate",
  entity: "User",
  entityId: "target-1",
  before: { status: "ACTIVE" },
  after: { status: "DEACTIVATED" },
  requestId: "req-1",
  ipAddress: "203.0.113.9",
};

const page = (items: unknown[] = [entry]) =>
  new Response(JSON.stringify({ items, total: items.length, page: 1, pageSize: 25 }), {
    status: 200,
  });

beforeEach(() => {
  fetchMock.mockReset();
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

async function mount(searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root?.render(
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
        <QueryClientProvider client={client}>
          <AuditLogView />
        </QueryClientProvider>
      </NuqsTestingAdapter>,
    ),
  );
  return container;
}

describe("AuditLogView", () => {
  test("shows who did what, the change and the request details", async () => {
    fetchMock.mockResolvedValue(page());

    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("root@example.test"));

    expect(view.textContent).toContain("admin.deactivate");
    expect(view.textContent).toContain("User target-1");
    expect(view.textContent).toContain("status: ACTIVE to DEACTIVATED");
    expect(view.textContent).toContain("203.0.113.9");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/admin/audit-log?page=1&pageSize=25");
  });

  test("filters held in the URL are restored on load and sent to the API", async () => {
    fetchMock.mockResolvedValue(page());

    const view = await mount("?actor=root%40example.test&from=2026-11-01&to=2026-11-10");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("actor=root%40example.test");
    expect(url).toContain("from=2026-11-01");
    expect(url).toContain("to=2026-11-10");
    expect((view.querySelector("#audit-actor") as HTMLInputElement).value).toBe(
      "root@example.test",
    );
    expect((view.querySelector("#audit-from") as HTMLInputElement).value).toBe("2026-11-01");
  });

  test("changing a date writes it to the URL", async () => {
    fetchMock.mockResolvedValue(page());
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const view = await mount("", onUrlUpdate);
    await vi.waitFor(() => expect(view.textContent).toContain("root@example.test"));

    const input = view.querySelector("#audit-from") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "2026-11-05");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await vi.waitFor(() =>
      expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain("from=2026-11-05"),
    );
  });

  test("the date inputs bound each other so the end cannot be before the start", async () => {
    fetchMock.mockResolvedValue(page());

    const view = await mount("?from=2026-11-05&to=2026-11-10");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect((view.querySelector("#audit-to") as HTMLInputElement).min).toBe("2026-11-05");
    expect((view.querySelector("#audit-from") as HTMLInputElement).max).toBe("2026-11-10");
    expect(view.textContent).not.toContain("must not be before");
  });

  test("an end date before the start date shows the message and sends no request", async () => {
    fetchMock.mockResolvedValue(page());

    const view = await mount("?from=2026-11-10&to=2026-11-05");

    expect(view.textContent).toContain("The end date must not be before the start date.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("shows an empty state, and an error with retry", async () => {
    fetchMock.mockResolvedValueOnce(page([]));
    const empty = await mount();
    await vi.waitFor(() => expect(empty.textContent).toContain("No audit entries yet"));
    await act(async () => root?.unmount());
    container?.remove();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "INTERNAL", message: "x", requestId: "r" } }), {
        status: 500,
      }),
    );
    const failed = await mount();
    await vi.waitFor(() => expect(failed.querySelector("[role=alert]")).not.toBeNull());
  });
});
