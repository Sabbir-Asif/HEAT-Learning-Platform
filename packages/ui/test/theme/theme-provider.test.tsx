import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ThemeProvider } from "../../src/theme/theme-provider";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function stubDevice(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("dark") ? dark : !dark,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

let root: Root;
let container: HTMLElement;

async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <ThemeProvider>
        <p>content</p>
      </ThemeProvider>,
    );
  });
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  test("a dark device setting with no stored choice puts the dark class on html", async () => {
    stubDevice(true);
    await mount();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("a light device setting does not add the dark class", async () => {
    stubDevice(false);
    await mount();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  test("a stored light choice wins over a dark device setting", async () => {
    stubDevice(true);
    window.localStorage.setItem("theme", "light");
    await mount();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  test("a stored dark choice wins over a light device setting", async () => {
    stubDevice(false);
    window.localStorage.setItem("theme", "dark");
    await mount();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("renders its children", async () => {
    stubDevice(false);
    await mount();
    expect(container.textContent).toContain("content");
  });
});
