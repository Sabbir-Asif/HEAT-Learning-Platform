import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { adminMeDescribe, setUnauthorizedHandler } from "@heat/api-client";
import { Providers } from "../src/shell/providers";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
const assign = vi.fn();
let root: Root | undefined;
let container: HTMLElement | undefined;

const unauthorised = () =>
  new Response(
    JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "x", requestId: "r" } }),
    { status: 401 },
  );

beforeEach(() => {
  fetchMock.mockReset();
  assign.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { pathname: "/students", search: "?x=1", assign });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  setUnauthorizedHandler(undefined);
  vi.unstubAllGlobals();
});

async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<Providers>content</Providers>));
}

describe("Providers", () => {
  test("a 401 is refreshed through the admin endpoint and the call is retried", async () => {
    fetchMock
      .mockResolvedValueOnce(unauthorised())
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: "u", email: "a@b.test", role: "ADMIN", mustChangePassword: false },
          }),
          { status: 200 },
        ),
      );
    await mount();

    await expect(adminMeDescribe()).resolves.toMatchObject({ user: { role: "ADMIN" } });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/admin/me",
      "/api/admin/auth/refresh",
      "/api/admin/me",
    ]);
  });

  test("a 401 whose refresh is also rejected sends the browser to sign-in with the current page", async () => {
    fetchMock.mockImplementation(async () => unauthorised());
    await mount();

    await expect(adminMeDescribe()).rejects.toMatchObject({ status: 401 });

    expect(assign).toHaveBeenCalledWith("/sign-in?next=%2Fstudents%3Fx%3D1");
    expect(container?.textContent).toBe("content");
  });

  test("a failed sign-in is not refreshed", async () => {
    fetchMock.mockImplementation(async () => unauthorised());
    await mount();
    const { adminAuthSignIn } = await import("@heat/api-client");

    await expect(adminAuthSignIn({ email: "a@b.test", password: "x" })).rejects.toMatchObject({
      status: 401,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
