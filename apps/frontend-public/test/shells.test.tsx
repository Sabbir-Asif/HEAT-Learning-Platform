import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/dashboard" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import { AuthShell } from "../src/shell/auth-shell";
import { LearnerShell } from "../src/shell/learner-shell";
import { PlaceholderPage } from "../src/shell/placeholder-page";
import { PublicShell } from "../src/shell/public-shell";
import RouteError from "../src/shell/route-error";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLElement | undefined;

async function mount(element: React.ReactElement) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(element));
  return container;
}

beforeEach(() => {
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
  vi.unstubAllGlobals();
});

describe("learner shell", () => {
  test("the bottom bar has exactly five items and marks the active one", async () => {
    pathname.value = "/learn/safety/intro";
    const view = await mount(
      <LearnerShell>
        <p>content</p>
      </LearnerShell>,
    );
    const bar = view.querySelector('[data-slot="bottom-bar"]') as HTMLElement;
    expect(bar.querySelectorAll("a")).toHaveLength(5);
    const current = bar.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe("My Learning");
  });

  test("renders one main landmark and a skip link to it", async () => {
    pathname.value = "/dashboard";
    const view = await mount(
      <LearnerShell>
        <p>content</p>
      </LearnerShell>,
    );
    expect(view.querySelectorAll("main")).toHaveLength(1);
    const skip = view.querySelector('[data-slot="skip-link"]') as HTMLAnchorElement;
    expect(skip.getAttribute("href")).toBe(`#${view.querySelector("main")?.id}`);
  });
});

describe("public shell", () => {
  test("has one main landmark, primary navigation and sign in and enroll actions", async () => {
    pathname.value = "/about";
    const view = await mount(
      <PublicShell>
        <p>content</p>
      </PublicShell>,
    );
    expect(view.querySelectorAll("main")).toHaveLength(1);
    expect(view.querySelector('nav[aria-label="Primary"] [aria-current="page"]')?.textContent).toBe(
      "About",
    );
    const hrefs = [...view.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/sign-in");
    expect(hrefs).toContain("/enroll");
  });
});

describe("auth shell and shared pieces", () => {
  test("the auth shell holds the form in one main landmark", async () => {
    const view = await mount(
      <AuthShell>
        <p>form</p>
      </AuthShell>,
    );
    expect(view.querySelectorAll("main")).toHaveLength(1);
    expect(view.querySelector("main")?.textContent).toContain("form");
  });

  test("the placeholder page names itself and says it is coming soon", async () => {
    const view = await mount(<PlaceholderPage title="Certificates" />);
    expect(view.querySelector("h1")?.textContent).toBe("Certificates");
    expect(view.textContent).toContain("This page is coming soon");
  });

  test("the route error retries through reset", async () => {
    const reset = vi.fn();
    const view = await mount(<RouteError error={new Error("x")} reset={reset} />);
    const retry = [...view.querySelectorAll("button")].find((b) => b.textContent === "Retry");
    await act(async () => retry?.click());
    expect(reset).toHaveBeenCalledOnce();
  });
});
