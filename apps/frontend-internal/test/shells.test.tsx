import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import { AdminShell } from "../src/shell/admin-shell";
import { AuthShell } from "../src/shell/auth-shell";
import { PlaceholderPage } from "../src/shell/placeholder-page";
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
    matches: query.includes("max-width"),
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

describe("admin shell", () => {
  test("shows breadcrumbs for the current path and one main landmark", async () => {
    pathname.value = "/directory/faculties";
    const view = await mount(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    expect(view.querySelectorAll("main")).toHaveLength(1);
    expect(view.querySelector('[aria-current="page"]')?.textContent).toBe("Faculties");
  });

  test("the drawer lists the admin navigation and closes when a link is selected", async () => {
    pathname.value = "/";
    const view = await mount(
      <AdminShell isSuperAdmin>
        <p>content</p>
      </AdminShell>,
    );
    const trigger = view.querySelector('[data-sidebar="trigger"]') as HTMLButtonElement;
    await act(async () => trigger.click());
    const nav = document.querySelector('nav[aria-label="Admin"]') as HTMLElement;
    expect(nav).not.toBeNull();
    expect(nav.querySelector('a[href="/admins"]')).not.toBeNull();
    const link = nav.querySelector('a[href="/videos"]') as HTMLAnchorElement;
    link.addEventListener("click", (event) => event.preventDefault());
    await act(async () => link.click());
    expect(document.querySelector('[role="dialog"][data-open]')).toBeNull();
  });
});

describe("admin shell for a plain admin", () => {
  test("hides the Admins and Audit log pages from the navigation", async () => {
    pathname.value = "/";
    const view = await mount(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    await act(async () =>
      (view.querySelector('[data-sidebar="trigger"]') as HTMLButtonElement).click(),
    );
    const nav = document.querySelector('nav[aria-label="Admin"]') as HTMLElement;
    expect(nav.querySelector('a[href="/audit-log"]')).toBeNull();
    expect(nav.querySelector('a[href="/admins"]')).toBeNull();
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
  });

  test("the placeholder page names itself", async () => {
    const view = await mount(<PlaceholderPage title="Videos" />);
    expect(view.querySelector("h1")?.textContent).toBe("Videos");
  });

  test("the route error retries through reset", async () => {
    const reset = vi.fn();
    const view = await mount(<RouteError error={new Error("x")} reset={reset} />);
    const retry = [...view.querySelectorAll("button")].find((b) => b.textContent === "Retry");
    await act(async () => retry?.click());
    expect(reset).toHaveBeenCalledOnce();
  });
});
