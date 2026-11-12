import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useUnsavedChangesGuard } from "../../src/site-pages/use-unsaved-changes-guard";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLElement | undefined;
let latest: ReturnType<typeof useUnsavedChangesGuard> | undefined;

function Probe({ dirty }: { dirty: boolean }) {
  latest = useUnsavedChangesGuard(dirty);
  return <a href="/courses">Courses</a>;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  latest = undefined;
  push.mockReset();
});

const mount = (dirty: boolean) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<Probe dirty={dirty} />));
};

const clickLink = (): MouseEvent => {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  act(() => {
    container?.querySelector("a")?.dispatchEvent(event);
  });
  return event;
};

describe("useUnsavedChangesGuard", () => {
  test("lets a link through when nothing changed", () => {
    mount(false);
    expect(clickLink().defaultPrevented).toBe(false);
    expect(latest?.confirming).toBe(false);
  });

  test("holds a link click and asks for confirmation when edits are unsaved", () => {
    mount(true);
    expect(clickLink().defaultPrevented).toBe(true);
    expect(latest?.confirming).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  test("navigates once the admin confirms leaving", () => {
    mount(true);
    clickLink();
    act(() => latest?.leave());
    expect(push).toHaveBeenCalledWith("/courses");
    expect(latest?.confirming).toBe(false);
  });

  test("stays on the page when the admin keeps editing", () => {
    mount(true);
    clickLink();
    act(() => latest?.stay());
    expect(latest?.confirming).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  test("warns before the tab closes", () => {
    mount(true);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
