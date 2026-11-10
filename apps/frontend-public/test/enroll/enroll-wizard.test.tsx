import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EnrollWizard } from "../../src/enroll/enroll-wizard";
import { readStepOne, stepOneStorageKey } from "../../src/enroll/step-one-store";

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

const lists: Record<string, unknown[]> = {
  "/api/directory/universities": [{ id: universityId, name: "University of Dhaka" }],
  [`/api/directory/universities/${universityId}/faculties`]: [
    { id: facultyId, name: "Faculty of Arts" },
  ],
  [`/api/directory/universities/${universityId}/faculties/${facultyId}/departments`]: [
    { id: departmentId, name: "Department of History" },
  ],
};

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

function respondWith(overrides: Record<string, unknown[] | "fail"> = {}) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    const body = overrides[url] ?? lists[url];
    if (body === "fail") return new Response("{}", { status: 500 });
    return new Response(JSON.stringify({ items: body ?? [] }), { status: 200 });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  respondWith();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

async function mount() {
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
  await act(async () => undefined);
  return container;
}

async function submit(view: HTMLElement) {
  await act(async () => {
    view
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => undefined);
}

const triggers = (view: HTMLElement) =>
  Array.from(view.querySelectorAll<HTMLButtonElement>("[data-slot=select-trigger]"));

describe("EnrollWizard step one", () => {
  test("shows the five fields with faculty and department disabled until chosen", async () => {
    const view = await mount();

    await vi.waitFor(() => expect(view.textContent).not.toContain("Loading universities"));
    const [university, faculty, department] = triggers(view);
    expect(university?.hasAttribute("disabled")).toBe(false);
    expect(faculty?.hasAttribute("disabled")).toBe(true);
    expect(department?.hasAttribute("disabled")).toBe(true);
    expect(triggers(view).length).toBe(3);
  });

  test("asks for every field and does not advance on an empty submit", async () => {
    const view = await mount();

    await submit(view);

    expect(view.textContent).toContain("Enter your name in English letters.");
    expect(view.textContent).toContain(
      "Use the format 2020-21, where the second part is the next year.",
    );
    expect(view.textContent).not.toContain("Create your account");
  });

  test("rejects a name with non-English characters", async () => {
    sessionStorage.setItem(stepOneStorageKey, JSON.stringify({ ...stored, name: "সাব্বির" }));
    const view = await mount();

    await submit(view);

    expect(view.textContent).toContain("Enter your name in English letters.");
    expect(view.textContent).not.toContain("Create your account");
  });

  test("restores the stored values after a reload", async () => {
    sessionStorage.setItem(stepOneStorageKey, JSON.stringify(stored));
    const view = await mount();

    const inputs = Array.from(view.querySelectorAll("input")).map((input) => input.value);
    expect(inputs).toContain("Anne Smith");
    expect(inputs).toContain("2020-21");
    await vi.waitFor(() => {
      expect(view.textContent).toContain("University of Dhaka");
      expect(view.textContent).toContain("Faculty of Arts");
      expect(view.textContent).toContain("Department of History");
    });
  });

  test("moves to step two and saves the values when everything is valid", async () => {
    sessionStorage.setItem(
      stepOneStorageKey,
      JSON.stringify({ ...stored, name: "  Anne   Smith " }),
    );
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Department of History"));

    await submit(view);

    expect(view.textContent).toContain("Create your account");
    expect(readStepOne()).toEqual(stored);
  });

  test("clears a stored faculty that the university no longer offers", async () => {
    sessionStorage.setItem(stepOneStorageKey, JSON.stringify(stored));
    respondWith({
      [`/api/directory/universities/${universityId}/faculties`]: [
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Faculty of Law" },
      ],
    });
    const view = await mount();

    await vi.waitFor(() => expect(triggers(view)[1]?.textContent).toContain("Select your faculty"));
    await vi.waitFor(() =>
      expect(triggers(view)[2]?.textContent).toContain("Select your department"),
    );
    await submit(view);
    expect(view.textContent).not.toContain("Create your account");
  });

  test("shows the error state with retry when a lookup fails and blocks Next", async () => {
    respondWith({ "/api/directory/universities": "fail" });
    const view = await mount();

    await vi.waitFor(() => expect(view.querySelector("[data-slot=error-state]")).not.toBeNull());
    const next = Array.from(view.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Next"),
    );
    expect(next?.hasAttribute("disabled")).toBe(true);

    respondWith();
    const retry = Array.from(view.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Retry"),
    );
    await act(async () => retry?.click());
    await vi.waitFor(() => expect(view.querySelector("[data-slot=error-state]")).toBeNull());
    expect(next?.hasAttribute("disabled")).toBe(false);
  });

  test("shows an empty state when the university has no faculties", async () => {
    sessionStorage.setItem(
      stepOneStorageKey,
      JSON.stringify({ ...stored, facultyId: "", departmentId: "" }),
    );
    respondWith({ [`/api/directory/universities/${universityId}/faculties`]: [] });
    const view = await mount();

    await vi.waitFor(() => expect(view.querySelector("[data-slot=empty-state]")).not.toBeNull());
    const next = Array.from(view.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Next"),
    );
    expect(next?.hasAttribute("disabled")).toBe(true);
  });

  test("never puts step one values in a request URL or body", async () => {
    sessionStorage.setItem(stepOneStorageKey, JSON.stringify(stored));
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Department of History"));
    await submit(view);

    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain("Anne");
      expect(String(url)).not.toContain("2020-21");
      expect(init?.body).toBeUndefined();
    }
  });
});
