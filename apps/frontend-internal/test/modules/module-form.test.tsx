import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ModuleSummaryDto } from "@heat/api-client";
import { ModuleForm } from "../../src/modules/module-form";

vi.mock("@heat/api-client", () => ({
  isApiError: () => false,
  useModulesCreate: () => ({ mutateAsync: vi.fn() }),
  useModulesUpdate: () => ({ mutateAsync: vi.fn() }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

const moduleOf = (overrides: Partial<ModuleSummaryDto> = {}): ModuleSummaryDto => ({
  id: "0198f1a0-0000-7000-8000-0000000000a1",
  order: 1,
  title: "Consent",
  objectives: ["Know"],
  sections: [],
  createdAt: "2026-11-11T06:00:00.000Z",
  updatedAt: "2026-11-11T06:00:00.000Z",
  ...overrides,
});

const show = (module: ModuleSummaryDto) => {
  const element = (
    <ModuleForm courseId="c" module={module} locked={false} onSaved={() => undefined} />
  );
  if (root === undefined) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  act(() => root?.render(element));
};

const titleInput = (): HTMLInputElement => {
  const input = container?.querySelector<HTMLInputElement>('input[name="title"]');
  if (!input) throw new Error("title input missing");
  return input;
};

const type = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("ModuleForm", () => {
  test("keeps unsaved edits when the same module is replaced by a section change", () => {
    show(moduleOf());
    type(titleInput(), "Consent and boundaries");
    show(
      moduleOf({
        updatedAt: "2026-11-11T07:00:00.000Z",
        sections: [{ id: "0198f1a0-0000-7000-8000-0000000000b1", order: 1, title: "Intro" }],
      }),
    );
    expect(titleInput().value).toBe("Consent and boundaries");
  });

  test("shows the new values when a clean form receives a changed module", () => {
    show(moduleOf());
    show(moduleOf({ title: "Renamed elsewhere" }));
    expect(titleInput().value).toBe("Renamed elsewhere");
  });

  test("resets to a different module even when the form was edited", () => {
    show(moduleOf());
    type(titleInput(), "Edited");
    show(moduleOf({ id: "0198f1a0-0000-7000-8000-0000000000a2", title: "Other" }));
    expect(titleInput().value).toBe("Other");
  });
});
