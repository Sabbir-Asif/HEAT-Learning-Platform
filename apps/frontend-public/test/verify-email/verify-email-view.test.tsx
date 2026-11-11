import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VerifyEmailView } from "../../src/verify-email/verify-email-view";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string }) => <a href={href} {...props} />,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;
let confirmResponse: () => Response;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const apiError = (code: string, status: number) =>
  json({ error: { code, message: code, requestId: "r1" } }, status);

const me = {
  user: {
    id: "u",
    email: "a@b.test",
    role: "STUDENT",
    emailVerified: true,
    mustChangePassword: false,
  },
  enrollments: [],
  verificationEmail: null,
  verificationEmailSentAt: null,
};

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  confirmResponse = () => json(me);
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === "/api/auth/verify-email") return confirmResponse();
    if (url === "/api/captcha") {
      return json({
        id: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
        expiresInSeconds: 300,
      });
    }
    return apiError("NOT_FOUND", 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () =>
    root?.render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <VerifyEmailView token="abc" />
        </QueryClientProvider>
      </StrictMode>,
    ),
  );
  await act(async () => undefined);
  return container;
}

const confirmCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) === "/api/auth/verify-email");

describe("VerifyEmailView", () => {
  test("confirms once on mount, even in strict mode, and sends the token", async () => {
    await mount();

    await vi.waitFor(() => expect(confirmCalls()).toHaveLength(1));
    expect(JSON.parse(String(confirmCalls()[0]?.[1]?.body))).toEqual({ token: "abc" });
  });

  test("shows a status while confirming", async () => {
    confirmResponse = () => new Response(null);
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    const view = await mount();

    expect(view.querySelector("[role=status]")?.textContent).toContain("Verifying your email");
  });

  test("goes to the awaiting page after success", async () => {
    const view = await mount();

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/awaiting-approval"));
    expect(view.textContent).toContain("Email verified");
  });

  test("says a used link was already used or replaced and links to sign in", async () => {
    confirmResponse = () => apiError("VERIFICATION_LINK_USED", 409);

    const view = await mount();

    await vi.waitFor(() => expect(view.textContent).toContain("already used or has been replaced"));
    expect(view.querySelector('a[href="/sign-in"]')).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  test("offers the resend form for an expired link", async () => {
    confirmResponse = () => apiError("VERIFICATION_LINK_EXPIRED", 410);

    const view = await mount();

    await vi.waitFor(() => expect(view.textContent).toContain("This link has expired"));
    await vi.waitFor(() => expect(view.querySelector("input[type=email]")).not.toBeNull());
    expect(view.textContent).toContain("Send a new link");
  });

  test("shows a generic message for an invalid link with no resend form", async () => {
    confirmResponse = () => apiError("VERIFICATION_LINK_INVALID", 404);

    const view = await mount();

    await vi.waitFor(() => expect(view.textContent).toContain("This link is not valid"));
    expect(view.querySelector("input[type=email]")).toBeNull();
  });

  test("offers a retry after a rate limit and confirms again when pressed", async () => {
    confirmResponse = () => apiError("RATE_LIMITED", 429);
    const view = await mount();
    await vi.waitFor(() => expect(view.querySelector("[role=alert]")).not.toBeNull());

    confirmResponse = () => json(me);
    const retry = Array.from(view.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Retry"),
    );
    await act(async () => retry?.click());

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/awaiting-approval"));
    expect(confirmCalls()).toHaveLength(2);
  });
});
