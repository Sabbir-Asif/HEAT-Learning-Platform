import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AcceptInvite } from "../../src/admins/accept-invite";
import { invitationExpiredMessage, invitationInvalidMessage } from "../../src/admins/admin-copy";
import { breachedPasswordMessage } from "../../src/auth/change-password-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const errorReply = (code: string, status = 400) =>
  json({ error: { code, message: "x", requestId: "r" } }, status);

async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root?.render(
      <QueryClientProvider client={client}>
        <AcceptInvite token="the-token" />
      </QueryClientProvider>,
    ),
  );
  return container;
}

async function submitPassword(view: HTMLElement, value: string) {
  await vi.waitFor(() => expect(view.querySelector("input[type=password]")).not.toBeNull());
  const input = view.querySelector<HTMLInputElement>("input[type=password]");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    view
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("AcceptInvite", () => {
  test("shows a loading state while the invitation is checked", async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    const view = await mount();

    expect(view.querySelector("[aria-busy=true]")?.textContent).toContain("Checking");
  });

  test("a valid invitation asks for a password and posts it with the token", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "VALID", email: "new@example.test" }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("new@example.test"));

    await submitPassword(view, "a brand new passphrase");

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("set"),
    );
    expect(view.querySelector("a")?.getAttribute("href")).toBe("/sign-in");
    const [url, init] = fetchMock.mock.calls[1] ?? [];
    expect(url).toBe("/api/admin/auth/invitations/accept");
    expect(JSON.parse(String(init?.body))).toEqual({
      token: "the-token",
      password: "a brand new passphrase",
    });
    expect(view.textContent).not.toMatch(/authenticator|two-factor|2fa/i);
  });

  test("refuses a short password without calling the API", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "VALID", email: "new@example.test" }));
    const view = await mount();

    await submitPassword(view, "short");

    expect(view.textContent).toContain("Use at least 12 characters.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("an expired invitation says so", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "EXPIRED" }));

    const view = await mount();

    await vi.waitFor(() => expect(view.textContent).toContain("Invitation expired"));
    expect(view.textContent).toContain(invitationExpiredMessage);
    expect(view.querySelector("form")).toBeNull();
  });

  test("an unknown or used invitation says it is not valid", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "INVALID" }));

    const view = await mount();

    await vi.waitFor(() => expect(view.textContent).toContain(invitationInvalidMessage));
  });

  test("a lookup failure offers a retry", async () => {
    fetchMock.mockResolvedValueOnce(errorReply("INTERNAL", 500));

    const view = await mount();

    await vi.waitFor(() => expect(view.querySelector("[role=alert]")).not.toBeNull());
  });

  test("an invitation that expires while the form is open switches to the expired message", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "VALID", email: "new@example.test" }));
    fetchMock.mockResolvedValueOnce(errorReply("INVITATION_EXPIRED"));
    const view = await mount();

    await submitPassword(view, "a brand new passphrase");

    await vi.waitFor(() => expect(view.textContent).toContain("Invitation expired"));
  });

  test("a breached password is shown on the field and the form stays open", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "VALID", email: "new@example.test" }));
    fetchMock.mockResolvedValueOnce(errorReply("PASSWORD_BREACHED"));
    const view = await mount();

    await submitPassword(view, "a brand new passphrase");

    await vi.waitFor(() => expect(view.textContent).toContain(breachedPasswordMessage));
    expect(view.querySelector("form")).not.toBeNull();
  });

  test("a rate limited submit shows the wait time", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "VALID", email: "new@example.test" }));
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED", message: "x", requestId: "r" } }),
        { status: 429, headers: { "retry-after": "30" } },
      ),
    );
    const view = await mount();

    await submitPassword(view, "a brand new passphrase");

    await vi.waitFor(() =>
      expect(view.querySelector("[role=alert]")?.textContent).toBe(
        "Too many attempts. Try again in 30 seconds.",
      ),
    );
  });
});
