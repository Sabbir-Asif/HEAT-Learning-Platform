import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EnrollWizard } from "../../src/enroll/enroll-wizard";
import { stepOneStorageKey } from "../../src/enroll/step-one-store";
import { supportEmail } from "../../src/enroll/step-two";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const universityId = "7b1c1d2e-3f4a-4b5c-8d6e-9f0a1b2c3d4e";
const facultyId = "8c2d2e3f-4a5b-4c6d-9e7f-0a1b2c3d4e5f";
const departmentId = "9d3e3f4a-5b6c-4d7e-8f80-1b2c3d4e5f60";
const stored = {
  name: "Anne Smith",
  universityId,
  facultyId,
  departmentId,
  session: "2020-21",
};
const firstCaptcha = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";
const secondCaptcha = "2c5f39cb-3fb2-42e3-994f-1127e4ddb538";
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
const password = "correct horse battery";

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;
let issued = 0;
let enrollmentResponse: () => Response;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const apiError = (code: string, status = 400) =>
  json({ error: { code, message: code, requestId: "r1" } }, status);

beforeEach(() => {
  issued = 0;
  fetchMock.mockReset();
  enrollmentResponse = () => json({ accepted: true }, 202);
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === "/api/captcha") {
      issued += 1;
      return json({
        id: issued === 1 ? firstCaptcha : secondCaptcha,
        svg,
        expiresInSeconds: 300,
      });
    }
    if (url === "/api/enrollment") return enrollmentResponse();
    if (url.endsWith("/departments")) {
      return json({ items: [{ id: departmentId, name: "Department of History" }] });
    }
    if (url.endsWith("/faculties")) return json({ items: [{ id: facultyId, name: "Arts" }] });
    return json({ items: [{ id: universityId, name: "University of Dhaka" }] });
  });
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem(stepOneStorageKey, JSON.stringify(stored));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

const settle = () => act(async () => undefined);

async function openStepTwo() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root?.render(
      <QueryClientProvider client={client}>
        <EnrollWizard />
      </QueryClientProvider>,
    ),
  );
  await settle();
  await vi.waitFor(() => expect(container?.textContent).toContain("Department of History"));
  await submitForm();
  await vi.waitFor(() => expect(container?.textContent).toContain("Create your account"));
  await vi.waitFor(() => expect(container?.querySelector("img")).not.toBeNull());
  return container;
}

async function submitForm() {
  await act(async () => {
    container
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}

async function type(view: HTMLElement, label: string, value: string) {
  const input = Array.from(view.querySelectorAll<HTMLInputElement>("input")).find((candidate) =>
    view.querySelector(`label[for="${candidate.id}"]`)?.textContent?.includes(label),
  );
  if (!input) throw new Error(`No input labelled ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function fillValid(view: HTMLElement, answer = "AB12") {
  await type(view, "Email", "Anne@Example.com");
  await type(view, "Password", password);
  await type(view, "Retype password", password);
  await type(view, "Security check", answer);
}

const enrollmentCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) === "/api/enrollment");

describe("EnrollWizard step two", () => {
  test("shows the support contact next to the captcha", async () => {
    const view = await openStepTwo();

    const link = view.querySelector<HTMLAnchorElement>(`a[href="mailto:${supportEmail}"]`);
    expect(link).not.toBeNull();
    const hint = link?.closest("[id$=-hint]");
    const input = view.querySelector<HTMLInputElement>("input[aria-describedby*='-hint']");
    expect(input?.getAttribute("aria-describedby")).toContain(hint?.id);
  });

  test("shows a field error on the confirmation and sends nothing when passwords differ", async () => {
    const view = await openStepTwo();
    await fillValid(view);
    await type(view, "Retype password", "something else entirely");

    await submitForm();

    expect(view.textContent).toContain("The passwords do not match.");
    expect(enrollmentCalls()).toHaveLength(0);
  });

  test("keeps the other values and loads a new captcha after a wrong answer", async () => {
    enrollmentResponse = () => apiError("CAPTCHA_INVALID");
    const view = await openStepTwo();
    await fillValid(view, "WRONG");

    await submitForm();

    await vi.waitFor(() => expect(issued).toBe(2));
    const captchaCalls = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/captcha");
    expect(JSON.parse(String(captchaCalls[1]?.[1]?.body))).toEqual({ replaces: firstCaptcha });
    expect(view.textContent).toContain("The characters do not match. Try again.");
    const values = Array.from(view.querySelectorAll("input")).map((input) => input.value);
    expect(values).toContain("Anne@Example.com");
    expect(values).toContain(password);
    expect(values).not.toContain("WRONG");
  });

  test("shows the retry time and keeps the captcha when rate limited", async () => {
    enrollmentResponse = () =>
      new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED", message: "x", requestId: "r1" } }),
        { status: 429, headers: { "content-type": "application/json", "retry-after": "120" } },
      );
    const view = await openStepTwo();
    await fillValid(view);

    await submitForm();

    await vi.waitFor(() => expect(view.textContent).toContain("Try again in 2 minutes."));
    expect(issued).toBe(1);
  });

  test("sends the full payload, shows the success screen and clears step one", async () => {
    const view = await openStepTwo();
    await fillValid(view);

    await submitForm();

    await vi.waitFor(() => expect(view.textContent).toContain("Check your email"));
    expect(view.textContent).toContain("anne@example.com");
    expect(JSON.parse(String(enrollmentCalls()[0]?.[1]?.body))).toEqual({
      ...stored,
      email: "anne@example.com",
      password,
      confirmPassword: password,
      captchaId: firstCaptcha,
      captchaAnswer: "AB12",
    });
    expect(sessionStorage.getItem(stepOneStorageKey)).toBeNull();
  });

  test("never writes the password to storage", async () => {
    const view = await openStepTwo();
    await fillValid(view);
    await submitForm();

    const everything = JSON.stringify({ ...sessionStorage, ...localStorage });
    expect(everything).not.toContain(password);
  });
});
