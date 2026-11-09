import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { meDescribe, setUnauthorizedHandler } from "@heat/api-client";
import { Providers } from "../src/shell/providers";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
const assign = vi.fn();
let root: Root | undefined;
let container: HTMLElement | undefined;

const unauthorised = () =>
  new Response(
    JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "x", requestId: "r" } }),
    {
      status: 401,
    },
  );

beforeEach(() => {
  fetchMock.mockReset();
  assign.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { pathname: "/learn/a", search: "?x=1", assign });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  setUnauthorizedHandler(undefined);
  vi.unstubAllGlobals();
});

describe("Providers", () => {
  test("a 401 whose refresh is also rejected sends the browser to sign-in with the current page", async () => {
    fetchMock.mockImplementation(async () => unauthorised());
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root?.render(<Providers>content</Providers>));

    await expect(meDescribe()).rejects.toMatchObject({ status: 401 });

    expect(assign).toHaveBeenCalledWith("/sign-in?next=%2Flearn%2Fa%3Fx%3D1");
    expect(container.textContent).toBe("content");
  });
});
