import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AdminsView } from "../../src/admins/admins-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const row = (overrides: Record<string, unknown>) => ({
  id: "0198f1a0-0000-7000-8000-000000000001",
  email: "someone@example.test",
  role: "ADMIN",
  status: "ACTIVE",
  createdAt: "2026-11-01T04:00:00.000Z",
  inviteExpiresAt: null,
  deactivatedAt: null,
  ...overrides,
});

const rows = [
  row({
    id: "0198f1a0-0000-7000-8000-0000000000aa",
    email: "root@example.test",
    role: "SUPER_ADMIN",
  }),
  row({ id: "0198f1a0-0000-7000-8000-0000000000bb", email: "active@example.test" }),
  row({
    id: "0198f1a0-0000-7000-8000-0000000000cc",
    email: "invited@example.test",
    status: "INVITED",
    inviteExpiresAt: "2026-11-13T04:00:00.000Z",
  }),
  row({
    id: "0198f1a0-0000-7000-8000-0000000000dd",
    email: "expired@example.test",
    status: "INVITE_EXPIRED",
    inviteExpiresAt: "2026-11-02T04:00:00.000Z",
  }),
  row({
    id: "0198f1a0-0000-7000-8000-0000000000ee",
    email: "off@example.test",
    status: "DEACTIVATED",
    deactivatedAt: "2026-11-05T04:00:00.000Z",
  }),
];

const list = (items = rows) =>
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

async function mount(currentUserId = "0198f1a0-0000-7000-8000-0000000000aa") {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root?.render(
      <NuqsTestingAdapter>
        <QueryClientProvider client={client}>
          <AdminsView currentUserId={currentUserId} />
        </QueryClientProvider>
      </NuqsTestingAdapter>,
    ),
  );
  return container;
}

const buttonNamed = (name: string, scope: ParentNode = document) =>
  [...scope.querySelectorAll("button")].find((button) => button.textContent?.includes(name));

describe("AdminsView", () => {
  test("lists admins with status labels and the actions each status allows", async () => {
    fetchMock.mockResolvedValue(list());

    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("active@example.test"));

    for (const label of ["Active", "Invited", "Invite expired", "Deactivated"]) {
      expect(view.textContent).toContain(label);
    }
    expect(view.querySelectorAll("button")).toBeTruthy();
    expect(view.textContent?.match(/Resend invitation/g)).toHaveLength(2);
    expect(view.textContent?.match(/Reactivate/g)).toHaveLength(1);
    expect(view.textContent?.match(/Deactivate(?!d)/g)?.length).toBe(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/admin/admins?page=1&pageSize=25");
  });

  test("an admin viewing the list gets no deactivate action on their own row", async () => {
    fetchMock.mockResolvedValue(list([row({ id: "me", email: "me@example.test" })]));

    const view = await mount("me");
    await vi.waitFor(() => expect(view.textContent).toContain("me@example.test"));

    expect(buttonNamed("Deactivate", view)).toBeUndefined();
  });

  test("shows an empty state, a loading state and an error with retry", async () => {
    fetchMock.mockResolvedValueOnce(list([]));
    const empty = await mount();
    await vi.waitFor(() => expect(empty.textContent).toContain("No admins yet"));
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

  test("resending an invitation calls the API and confirms", async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith("/resend-invitation")
        ? new Response(JSON.stringify(rows[2]), { status: 200 })
        : list(),
    );
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("invited@example.test"));

    await act(async () => buttonNamed("Resend invitation", view)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "A new invitation was sent to",
      ),
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url) ===
            "/api/admin/admins/0198f1a0-0000-7000-8000-0000000000cc/resend-invitation" &&
          init?.method === "POST",
      ),
    ).toBe(true);
  });

  test("deactivating names the admin in the confirmation and then calls the API", async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith("/deactivate")
        ? new Response(JSON.stringify(rows[1]), { status: 200 })
        : list(),
    );
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("active@example.test"));

    const activeRow = [...view.querySelectorAll("tr")].find((tr) =>
      tr.textContent?.includes("active@example.test"),
    );
    await act(async () => buttonNamed("Deactivate", activeRow ?? view)?.click());
    const dialog = document.querySelector("[data-slot=confirm-dialog]");
    expect(dialog?.textContent).toContain("active@example.test");
    await act(async () => buttonNamed("Deactivate", dialog ?? document)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("was deactivated"),
    );
  });

  test("reactivating calls the API and confirms", async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith("/reactivate")
        ? new Response(JSON.stringify(rows[4]), { status: 200 })
        : list(),
    );
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("off@example.test"));

    await act(async () => buttonNamed("Reactivate", view)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("can sign in again"),
    );
  });

  test("a failed resend says so", async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).endsWith("/resend-invitation")
        ? new Response(
            JSON.stringify({ error: { code: "INTERNAL", message: "x", requestId: "r" } }),
            {
              status: 500,
            },
          )
        : list(),
    );
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("invited@example.test"));

    await act(async () => buttonNamed("Resend invitation", view)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("could not be sent"),
    );
  });
});
