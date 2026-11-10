import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RefreshSession } from "../../src/auth/refresh-session";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
const replace = vi.fn();
let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  window.sessionStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { ...window.location, replace });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

async function mount(next: string) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <QueryClientProvider client={new QueryClient()}>
        <RefreshSession next={next} />
      </QueryClientProvider>,
    ),
  );
}

describe("RefreshSession", () => {
  test("refreshes through the admin endpoint once and returns to the requested page", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await mount("/students?x=1");

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/students?x=1"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/auth/refresh");
    expect(container?.querySelector("[role=status]")?.textContent).toContain(
      "Restoring your session",
    );
  });

  test("goes to sign-in, keeping the destination, when the refresh is rejected", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "x", requestId: "r" } }),
        { status: 401 },
      ),
    );

    await mount("/students");

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in?next=%2Fstudents"));
  });

  test("does not loop: a second refresh within seconds goes to sign-in without calling the API", async () => {
    window.sessionStorage.setItem("heat:admin-session-refreshed-at", String(Date.now()));

    await mount("/students");

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in?next=%2Fstudents"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
