import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleSwitch, type LocaleSwitchProps } from "../../src/locale-switch/locale-switch";

const options = [
  { value: "bn", label: "বাংলা", href: "/bn/courses" },
  { value: "en", label: "English", href: "/en/courses" },
];

const props: LocaleSwitchProps = { label: "Language", current: "en", options };

describe("markup", () => {
  test("is a nav named by the label, with one link per option", () => {
    const html = renderToStaticMarkup(<LocaleSwitch {...props} />);
    expect(html).toMatch(/^<nav [^>]*aria-label="Language"/);
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  test("each link carries its href, lang, hreflang and endonym", () => {
    const html = renderToStaticMarkup(<LocaleSwitch {...props} />);
    expect(html).toContain('href="/bn/courses"');
    expect(html).toContain('lang="bn"');
    expect(html.toLowerCase()).toContain('hreflang="bn"');
    expect(html).toContain(">বাংলা</a>");
    expect(html).toContain('href="/en/courses"');
    expect(html).toContain('lang="en"');
    expect(html.toLowerCase()).toContain('hreflang="en"');
    expect(html).toContain(">English</a>");
  });

  test("only the current option has aria-current", () => {
    const current = (html: string) =>
      [...html.matchAll(/<a ([^>]*)>/g)]
        .filter(([, attributes]) => attributes?.includes("aria-current"))
        .map(([, attributes]) =>
          /hrefLang="([^"]+)"|hreflang="([^"]+)"/
            .exec(attributes ?? "")
            ?.slice(1)
            .find(Boolean),
        );
    expect(current(renderToStaticMarkup(<LocaleSwitch {...props} />))).toEqual(["en"]);
    expect(current(renderToStaticMarkup(<LocaleSwitch {...props} current="bn" />))).toEqual(["bn"]);
  });

  test("marks no option current when none matches", () => {
    expect(renderToStaticMarkup(<LocaleSwitch {...props} current="fr" />)).not.toContain(
      "aria-current",
    );
  });

  test("renders without JavaScript behaviour when onChange is absent", () => {
    expect(renderToStaticMarkup(<LocaleSwitch {...props} />)).toContain("<a ");
  });
});

describe("activation", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const onChange = vi.fn();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    onChange.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(extra: Partial<LocaleSwitchProps> = {}) {
    act(() => root.render(createElement(LocaleSwitch, { ...props, onChange, ...extra })));
  }

  const link = (value: string) =>
    container.querySelector<HTMLAnchorElement>(`a[hreflang="${value}"]`)!;

  function click(element: Element, init: MouseEventInit = {}) {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
    act(() => {
      element.dispatchEvent(event);
    });
    return event;
  }

  test("a plain click on the other option calls onChange and stops the navigation", () => {
    render();
    const event = click(link("bn"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("bn");
    expect(event.defaultPrevented).toBe(true);
  });

  test("a click on the current option does nothing", () => {
    render();
    const event = click(link("en"));
    expect(onChange).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  test.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
    ["middle button", { button: 1 }],
  ])("a %s click keeps the browser's own link behaviour", (_name, init) => {
    render();
    const event = click(link("bn"), init);
    expect(onChange).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test("without onChange a click is left to the link", () => {
    act(() => root.render(createElement(LocaleSwitch, props)));
    const event = click(link("bn"));
    expect(event.defaultPrevented).toBe(false);
  });
});
