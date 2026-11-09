import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import AdminError from "../src/app/(admin)/error";
import AdminLoading from "../src/app/(admin)/loading";
import AuthError from "../src/app/(auth)/error";
import AuthLoading from "../src/app/(auth)/loading";

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

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe.each([
  ["admin", AdminLoading, AdminError],
  ["auth", AuthLoading, AuthError],
])("%s group states", (_name, Loading, ErrorView) => {
  test("loading announces itself and shows skeletons", async () => {
    const view = await mount(<Loading />);
    expect(view.querySelector('[role="status"]')?.textContent).toBe("Loading");
    expect(view.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  test("error offers a retry that calls reset", async () => {
    const reset = vi.fn();
    const view = await mount(<ErrorView error={new Error("x")} reset={reset} />);
    expect(view.querySelector('[role="alert"]')).not.toBeNull();
    const retry = [...view.querySelectorAll("button")].find((b) => b.textContent === "Retry");
    await act(async () => retry?.click());
    expect(reset).toHaveBeenCalledOnce();
  });
});
