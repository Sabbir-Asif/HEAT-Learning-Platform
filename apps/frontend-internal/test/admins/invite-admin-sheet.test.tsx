import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { emailInUseMessage } from "../../src/admins/admin-copy";
import { InviteAdminSheet } from "../../src/admins/invite-admin-sheet";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
const onInvited = vi.fn();
let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  fetchMock.mockReset();
  onInvited.mockReset();
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

async function open() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () =>
    root?.render(
      <QueryClientProvider client={client}>
        <InviteAdminSheet onInvited={onInvited} />
      </QueryClientProvider>,
    ),
  );
  await act(async () => container?.querySelector("button")?.click());
}

async function submit(email: string) {
  const input = document.querySelector<HTMLInputElement>("input[type=email]");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, email);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    document
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

const errorReply = (code: string, status: number) =>
  new Response(JSON.stringify({ error: { code, message: "x", requestId: "r" } }), { status });

describe("InviteAdminSheet", () => {
  test("refuses a malformed email without calling the API", async () => {
    await open();

    await submit("nope");

    expect(document.body.textContent).toContain("Enter a valid email address.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sends the invitation, reports it and closes", async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url) === "/api/admin/admins"
        ? new Response(JSON.stringify({ email: "new@example.test" }), { status: 201 })
        : new Response(null, { status: 204 }),
    );
    await open();

    await submit("new@example.test");

    await vi.waitFor(() => expect(onInvited).toHaveBeenCalledWith("new@example.test"));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      email: "new@example.test",
    });
    await vi.waitFor(() => expect(document.querySelector("form")).toBeNull());
  });

  test("an email already in use is shown on the field", async () => {
    fetchMock.mockResolvedValueOnce(errorReply("EMAIL_IN_USE", 409));
    await open();

    await submit("used@example.test");

    await vi.waitFor(() => expect(document.body.textContent).toContain(emailInUseMessage));
    expect(onInvited).not.toHaveBeenCalled();
  });

  test("a rate limited invitation shows the wait time", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED", message: "x", requestId: "r" } }),
        { status: 429, headers: { "retry-after": "120" } },
      ),
    );
    await open();

    await submit("new@example.test");

    await vi.waitFor(() =>
      expect(document.querySelector("[role=alert]")?.textContent).toBe(
        "Too many attempts. Try again in 2 minutes.",
      ),
    );
  });
});
