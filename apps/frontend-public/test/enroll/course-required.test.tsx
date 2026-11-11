import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { CourseRequired } from "../../src/enroll/course-required";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe("CourseRequired", () => {
  test("asks to pick a course first and offers the course list", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root?.render(<CourseRequired />));

    expect(container.textContent).toContain("Choose a course to enroll in");
    expect(container.querySelector('a[href="/courses"]')).not.toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });
});
