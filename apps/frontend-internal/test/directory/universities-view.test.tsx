import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { UniversitiesView } from "../../src/directory/universities-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "0198f1a0-0000-7000-8000-000000000001",
  name: "University of Dhaka",
  archivedAt: null,
  createdAt: "2026-11-01T04:00:00.000Z",
  updatedAt: "2026-11-01T04:00:00.000Z",
  studentCount: 0,
  departmentCount: 0,
  facultyCount: 0,
  ...overrides,
});

const rows = [
  row({ studentCount: 3, departmentCount: 2, facultyCount: 1 }),
  row({ id: "0198f1a0-0000-7000-8000-000000000002", name: "Unused University" }),
];

const list = (items: unknown[] = rows) =>
  new Response(JSON.stringify({ items, total: items.length, page: 1, pageSize: 25 }), {
    status: 200,
  });

const errorReply = (code: string, status: number) =>
  new Response(JSON.stringify({ error: { code, message: "x", requestId: "r" } }), { status });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
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
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

async function mount(searchParams = "") {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root?.render(
      <NuqsTestingAdapter searchParams={searchParams}>
        <QueryClientProvider client={client}>
          <UniversitiesView />
        </QueryClientProvider>
      </NuqsTestingAdapter>,
    ),
  );
  return container;
}

const buttonNamed = (name: string, scope: ParentNode = document) =>
  [...scope.querySelectorAll("button")].find((button) => button.textContent?.includes(name));

const rowOf = (view: HTMLElement, text: string) =>
  [...view.querySelectorAll("tr")].find((tr) => tr.textContent?.includes(text));

async function type(input: HTMLInputElement | null, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submitForm() {
  await act(async () => {
    document
      .querySelector("[data-slot=form]")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

const callsTo = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method);

describe("UniversitiesView list", () => {
  test("lists universities with their usage and asks the API for the first page", async () => {
    fetchMock.mockResolvedValue(list());

    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("University of Dhaka"));

    expect(view.textContent).toContain("Unused University");
    expect(rowOf(view, "University of Dhaka")?.textContent).toContain("3");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/admin/directory/universities?page=1&pageSize=25",
    );
  });

  test("sends the search text from the URL", async () => {
    fetchMock.mockResolvedValue(list([]));

    await mount("?q=dha");

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/admin/directory/universities?page=1&pageSize=25&q=dha",
    );
  });

  test("shows an empty state and an error with retry", async () => {
    fetchMock.mockResolvedValueOnce(list([]));
    const empty = await mount();
    await vi.waitFor(() => expect(empty.textContent).toContain("No universities yet"));
    await act(async () => root?.unmount());
    container?.remove();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(errorReply("INTERNAL", 500));
    const failed = await mount();
    await vi.waitFor(() => expect(failed.querySelector("[role=alert]")).not.toBeNull());
  });
});

describe("UniversitiesView create and edit", () => {
  test("refuses an empty name without calling the API", async () => {
    fetchMock.mockResolvedValue(list());
    const view = await mount();
    await act(async () => buttonNamed("Add university", view)?.click());

    await submitForm();

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Enter the university name."),
    );
    expect(callsTo("POST")).toHaveLength(0);
  });

  test("creates a university, reports it and refreshes the list", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? new Response(JSON.stringify(row({ name: "North South University" })), { status: 201 })
        : list(),
    );
    const view = await mount();
    await act(async () => buttonNamed("Add university", view)?.click());

    await type(document.querySelector("input[name=name]"), "  North South University ");
    await submitForm();

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("North South University"),
    );
    expect(JSON.parse(String(callsTo("POST")[0]?.[1]?.body))).toEqual({
      name: "North South University",
    });
    expect(document.querySelector("[data-slot=form]")).toBeNull();
  });

  test("a name that is taken is shown on the field and the sheet stays open", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST" ? errorReply("DIRECTORY_NAME_TAKEN", 409) : list(),
    );
    const view = await mount();
    await act(async () => buttonNamed("Add university", view)?.click());

    await type(document.querySelector("input[name=name]"), "University of Dhaka");
    await submitForm();

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("A university with this name already exists."),
    );
    expect(document.querySelector("[data-slot=form]")).not.toBeNull();
  });

  test("editing pre-fills the name and sends a PATCH to that university", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "PATCH"
        ? new Response(JSON.stringify(row({ name: "Renamed University" })), { status: 200 })
        : list(),
    );
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Unused University"));

    await act(async () => buttonNamed("Edit", rowOf(view, "Unused University") ?? view)?.click());
    expect(document.querySelector<HTMLInputElement>("input[name=name]")?.value).toBe(
      "Unused University",
    );
    await type(document.querySelector("input[name=name]"), "Renamed University");
    await submitForm();

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("Renamed University"),
    );
    expect(String(callsTo("PATCH")[0]?.[0])).toBe(
      "/api/admin/directory/universities/0198f1a0-0000-7000-8000-000000000002",
    );
  });

  test("closing a form with unsaved changes asks before discarding", async () => {
    fetchMock.mockResolvedValue(list());
    const view = await mount();
    await act(async () => buttonNamed("Add university", view)?.click());
    await type(document.querySelector("input[name=name]"), "Half typed");

    await act(async () => buttonNamed("Cancel")?.click());

    expect(document.body.textContent).toContain("You have unsaved changes");
    expect(document.querySelector("[data-slot=form]")).not.toBeNull();
    await act(async () => buttonNamed("Discard changes")?.click());
    expect(document.querySelector("[data-slot=form]")).toBeNull();
  });
});

describe("UniversitiesView delete", () => {
  const openDelete = async (view: HTMLElement, name: string) => {
    await vi.waitFor(() => expect(view.textContent).toContain(name));
    await act(async () => buttonNamed("Delete", rowOf(view, name) ?? view)?.click());
    return document.querySelector("[data-slot=confirm-dialog]") as HTMLElement;
  };

  test("the confirmation names the university and needs the name typed", async () => {
    fetchMock.mockResolvedValue(list());
    const view = await mount();

    const dialog = await openDelete(view, "Unused University");

    expect(dialog.textContent).toContain("Unused University");
    const confirm = buttonNamed("Delete university", dialog);
    expect(confirm?.disabled).toBe(true);
    await type(dialog.querySelector("input"), "Unused University");
    expect(confirm?.disabled).toBe(false);
  });

  test("deleting an unused university calls the API and confirms", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "DELETE" ? new Response(null, { status: 204 }) : list(),
    );
    const view = await mount();
    const dialog = await openDelete(view, "Unused University");

    await type(dialog.querySelector("input"), "Unused University");
    await act(async () => buttonNamed("Delete university", dialog)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Unused University was deleted",
      ),
    );
    expect(String(callsTo("DELETE")[0]?.[0])).toBe(
      "/api/admin/directory/universities/0198f1a0-0000-7000-8000-000000000002",
    );
  });

  test("a refused delete explains what references the university and suggests archiving", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "DELETE" ? errorReply("DIRECTORY_IN_USE", 409) : list(),
    );
    const view = await mount();
    const dialog = await openDelete(view, "University of Dhaka");

    await type(dialog.querySelector("input"), "University of Dhaka");
    await act(async () => buttonNamed("Delete university", dialog)?.click());

    await vi.waitFor(() => expect(dialog.querySelector("[role=alert]")).not.toBeNull());
    const message = dialog.querySelector("[role=alert]")?.textContent;
    expect(message).toContain("3 students, 2 departments and 1 faculty link");
    expect(message).toContain("Archive it instead");
  });
});
