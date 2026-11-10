import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ChangePasswordForm,
  breachedPasswordMessage,
  wrongCurrentPasswordMessage,
} from "../../src/auth/change-password-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
const assign = vi.fn();
let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  refresh.mockReset();
  assign.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

async function mount(forced: boolean) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () =>
    root?.render(
      <QueryClientProvider client={client}>
        <ChangePasswordForm forced={forced} />
      </QueryClientProvider>,
    ),
  );
  return container;
}

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function fill(view: HTMLElement, current: string, next: string) {
  const [currentInput, nextInput] = view.querySelectorAll<HTMLInputElement>("input[type=password]");
  await type(currentInput as HTMLInputElement, current);
  await type(nextInput as HTMLInputElement, next);
  await act(async () => {
    view
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

const errorReply = (code: string, status: number) =>
  new Response(JSON.stringify({ error: { code, message: "x", requestId: "r" } }), { status });

describe("ChangePasswordForm", () => {
  test("refuses a short new password without calling the API", async () => {
    const view = await mount(true);

    await fill(view, "old password value", "short");
    await act(async () => undefined);

    expect(view.textContent).toContain("Use at least 12 characters.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a forced change posts both passwords and returns to the console", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const view = await mount(true);

    await fill(view, "old password value", "a brand new passphrase");

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/admin/account/change-password");
    expect(JSON.parse(String(init?.body))).toEqual({
      currentPassword: "old password value",
      newPassword: "a brand new passphrase",
    });
  });

  test("a voluntary change stays on the page and confirms", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const view = await mount(false);

    await fill(view, "old password value", "a brand new passphrase");

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("Password changed"),
    );
    expect(assign).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  test("a wrong current password is shown on that field", async () => {
    fetchMock.mockResolvedValueOnce(errorReply("INVALID_CREDENTIALS", 400));
    const view = await mount(true);

    await fill(view, "not the password", "a brand new passphrase");

    await vi.waitFor(() => expect(view.textContent).toContain(wrongCurrentPasswordMessage));
    expect(assign).not.toHaveBeenCalled();
  });

  test("a breached password is shown on the new password field", async () => {
    fetchMock.mockResolvedValueOnce(errorReply("PASSWORD_BREACHED", 400));
    const view = await mount(true);

    await fill(view, "old password value", "a brand new passphrase");

    await vi.waitFor(() => expect(view.textContent).toContain(breachedPasswordMessage));
  });

  test("a connection failure shows a form message", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const view = await mount(true);

    await fill(view, "old password value", "a brand new passphrase");

    await vi.waitFor(() =>
      expect(view.querySelector("[role=alert]")?.textContent).toContain("connection failed"),
    );
  });
});
