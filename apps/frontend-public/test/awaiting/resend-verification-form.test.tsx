import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ResendVerificationForm } from "../../src/awaiting/resend-verification-form";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const firstCaptcha = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";
const secondCaptcha = "2c5f39cb-3fb2-42e3-994f-1127e4ddb538";
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;
let issued = 0;
let resendResponse: () => Response;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const apiError = (code: string, status: number) =>
  json({ error: { code, message: code, requestId: "r1" } }, status);

beforeEach(() => {
  issued = 0;
  fetchMock.mockReset();
  resendResponse = () => json({ accepted: true }, 202);
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === "/api/captcha") {
      issued += 1;
      return json({ id: issued === 1 ? firstCaptcha : secondCaptcha, svg, expiresInSeconds: 300 });
    }
    if (url === "/api/auth/verify-email/resend") return resendResponse();
    return apiError("NOT_FOUND", 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

async function mount(defaultEmail?: string) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () =>
    root?.render(
      <QueryClientProvider client={client}>
        <ResendVerificationForm defaultEmail={defaultEmail} />
      </QueryClientProvider>,
    ),
  );
  await vi.waitFor(() =>
    expect(container?.querySelector("input[aria-describedby]")).not.toBeNull(),
  );
  return container;
}

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function fillAndSubmit(view: HTMLElement, answer = "AB12") {
  const inputs = Array.from(view.querySelectorAll<HTMLInputElement>("input"));
  const email = inputs.find((input) => input.type === "email");
  const captcha = inputs.find((input) => input.type !== "email");
  if (!email || !captcha) throw new Error("Form fields missing");
  if (email.value === "") await type(email, "anne@example.com");
  await type(captcha, answer);
  await act(async () => {
    view
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => undefined);
}

const resendCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) === "/api/auth/verify-email/resend");

describe("ResendVerificationForm", () => {
  test("prefills the email when it is known", async () => {
    const view = await mount("anne@example.com");

    expect(view.querySelector<HTMLInputElement>("input[type=email]")?.value).toBe(
      "anne@example.com",
    );
  });

  test("sends the email with the captcha and shows the neutral confirmation", async () => {
    const view = await mount();

    await fillAndSubmit(view);

    await vi.waitFor(() => expect(resendCalls()).toHaveLength(1));
    expect(JSON.parse(String(resendCalls()[0]?.[1]?.body))).toEqual({
      email: "anne@example.com",
      captchaId: firstCaptcha,
      captchaAnswer: "AB12",
    });
    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toBe(
        "If this address is awaiting verification, a new link is on its way.",
      ),
    );
  });

  test("refreshes the captcha and flags the field when the check is wrong", async () => {
    resendResponse = () => apiError("CAPTCHA_INVALID", 400);
    const view = await mount();

    await fillAndSubmit(view, "ZZZZ");

    await vi.waitFor(() => expect(issued).toBe(2));
    await vi.waitFor(() => expect(view.textContent).toContain("The characters do not match"));
  });

  test("shows the resend limit message", async () => {
    resendResponse = () => apiError("VERIFICATION_RESEND_LIMIT", 429);
    const view = await mount();

    await fillAndSubmit(view);

    await vi.waitFor(() => expect(view.textContent).toContain("Too many verification emails"));
    expect(view.querySelector("form")).not.toBeNull();
  });

  test("shows an error with the form kept when the network fails", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (String(input) === "/api/captcha")
        return json({ id: firstCaptcha, svg, expiresInSeconds: 300 });
      throw new TypeError("offline");
    });
    const view = await mount();

    await fillAndSubmit(view);

    await vi.waitFor(() => expect(view.textContent).toContain("connection failed"));
  });
});
