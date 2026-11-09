import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SignInForm, destinationAfterSignIn } from "../../src/auth/sign-in-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string }) => <a href={href} {...props} />,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

async function mount(next = "/dashboard") {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () =>
    root?.render(
      <QueryClientProvider client={client}>
        <SignInForm next={next} />
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

async function submit(view: HTMLElement, email: string, password: string) {
  await type(view.querySelector<HTMLInputElement>("input[type=email]") as HTMLInputElement, email);
  await type(
    view.querySelector<HTMLInputElement>("input[type=password]") as HTMLInputElement,
    password,
  );
  await act(async () => {
    view
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => undefined);
}

const me = (status: string) => ({
  user: {
    id: "u",
    email: "a@b.test",
    role: "STUDENT",
    emailVerified: true,
    mustChangePassword: false,
  },
  enrollments: [{ courseId: "c", courseSlug: "s", courseTitle: "S", status }],
});

describe("destinationAfterSignIn", () => {
  test("goes to the requested page when a course is open", () => {
    expect(destinationAfterSignIn([{ status: "APPROVED" }], "/learn/s")).toBe("/learn/s");
    expect(destinationAfterSignIn([{ status: "COMPLETED" }], "/dashboard")).toBe("/dashboard");
  });

  test("goes to awaiting approval otherwise, whatever was requested", () => {
    expect(destinationAfterSignIn([{ status: "PENDING_APPROVAL" }], "/learn/s")).toBe(
      "/awaiting-approval",
    );
    expect(destinationAfterSignIn([], "/dashboard")).toBe("/awaiting-approval");
  });
});

describe("SignInForm", () => {
  test("shows validation messages and sends nothing for empty fields", async () => {
    const view = await mount();

    await act(async () => {
      view
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => undefined);

    expect(view.textContent).toContain("Enter a valid email address.");
    expect(view.textContent).toContain("Enter your password.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sends the credentials and lands on the dashboard for an approved student", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(me("APPROVED")), { status: 200 }));
    const view = await mount();

    await submit(view, " Student@Example.test ", "secret-pass");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/auth/sign-in");
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "student@example.test",
      password: "secret-pass",
    });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  test("lands on awaiting approval for a student with only a pending enrollment", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(me("PENDING_APPROVAL")), { status: 200 }),
    );
    const view = await mount();

    await submit(view, "a@b.test", "secret-pass");

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/awaiting-approval"));
  });

  test("shows one generic message for wrong credentials and does not navigate", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "INVALID_CREDENTIALS", message: "x", requestId: "r" } }),
        { status: 401 },
      ),
    );
    const view = await mount();

    await submit(view, "a@b.test", "wrong");

    await vi.waitFor(() =>
      expect(view.querySelector("[role=alert]")?.textContent).toBe(
        "The email or password is not correct.",
      ),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("shows a connection message when the request fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const view = await mount();

    await submit(view, "a@b.test", "secret-pass");

    await vi.waitFor(() =>
      expect(view.querySelector("[role=alert]")?.textContent).toContain("connection failed"),
    );
  });

  test("links to password recovery and enrollment", async () => {
    const view = await mount();

    const hrefs = [...view.querySelectorAll("a")].map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual(["/forgot-password", "/enroll"]);
  });
});
