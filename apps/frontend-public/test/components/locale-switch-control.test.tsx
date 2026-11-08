import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({ pathname: "/en/courses/x" }));
const changeLocale = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("../../src/i18n/change-locale", () => ({ changeLocale }));

import { LocaleSwitchControl } from "../../src/components/locale-switch-control";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.pathname = "/en/courses/x";
  changeLocale.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
});

const render = (current: "bn" | "en" = "en") =>
  act(() => root.render(<LocaleSwitchControl label="Language" current={current} />));
const link = (language: string) =>
  container.querySelector<HTMLAnchorElement>(`a[lang="${language}"]`)!;

describe("LocaleSwitchControl", () => {
  test("renders a labelled nav with both languages and hrefs for the current page", () => {
    render();
    expect(container.querySelector("nav")?.getAttribute("aria-label")).toBe("Language");
    expect(link("bn").textContent).toBe("বাংলা");
    expect(link("en").textContent).toBe("English");
    expect(link("bn").getAttribute("href")).toBe("/bn/courses/x");
    expect(link("en").getAttribute("href")).toBe("/en/courses/x");
    expect(link("en").getAttribute("aria-current")).toBe("true");
    expect(link("bn").getAttribute("aria-current")).toBeNull();
  });

  test("marks the Bangla option current on a Bangla page", () => {
    state.pathname = "/bn";
    render("bn");
    expect(link("bn").getAttribute("aria-current")).toBe("true");
    expect(link("bn").getAttribute("href")).toBe("/bn");
    expect(link("en").getAttribute("href")).toBe("/en");
  });

  test("choosing the other language hands the page, query and hash to changeLocale", () => {
    window.history.replaceState(null, "", "/en/courses/x?tab=2#notes");
    changeLocale.mockImplementation(({ writeCookie, navigate }) => {
      writeCookie("probe=1");
      navigate("#arrived");
    });
    render();
    act(() => {
      link("bn").dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    expect(changeLocale).toHaveBeenCalledOnce();
    expect(changeLocale.mock.calls[0]?.[0]).toMatchObject({
      target: "bn",
      pathname: "/en/courses/x",
      search: "?tab=2",
      hash: "#notes",
    });
    expect(document.cookie).toContain("probe=1");
    expect(window.location.hash).toBe("#arrived");
  });

  test("clicking the current language changes nothing", () => {
    render();
    act(() => {
      link("en").dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    expect(changeLocale).not.toHaveBeenCalled();
  });
});
