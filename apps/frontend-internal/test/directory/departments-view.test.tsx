import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DepartmentsView } from "../../src/directory/departments-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const dhaka = { id: "0198f1a0-0000-7000-8000-0000000000a1", name: "University of Dhaka" };
const buet = { id: "0198f1a0-0000-7000-8000-0000000000a2", name: "BUET" };
const arts = { id: "0198f1a0-0000-7000-8000-0000000000f1", name: "Faculty of Arts" };
const engineering = { id: "0198f1a0-0000-7000-8000-0000000000f2", name: "Faculty of Engineering" };
const anthropology = "0198f1a0-0000-7000-8000-0000000000d1";
const physics = "0198f1a0-0000-7000-8000-0000000000d2";
const stamp = "2026-11-01T04:00:00.000Z";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: anthropology,
  name: "Anthropology",
  university: dhaka,
  faculty: arts,
  archivedAt: null,
  createdAt: stamp,
  updatedAt: stamp,
  studentCount: 0,
  ...overrides,
});

const rows = [
  row({ studentCount: 3 }),
  row({ id: physics, name: "Physics", university: buet, faculty: engineering }),
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const page = (items: unknown[], pageSize = 25) =>
  json({ items, total: items.length, page: 1, pageSize });

const errorReply = (code: string, status: number) =>
  json({ error: { code, message: "x", requestId: "r" } }, status);

const universityOptions = () =>
  page(
    [dhaka, buet].map((university) => ({
      ...university,
      archivedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
      studentCount: 0,
      departmentCount: 0,
      facultyCount: 0,
    })),
    50,
  );

const facultyOptions = (url: string) =>
  page(
    (url.includes(`universityId=${buet.id}`) ? [engineering] : [arts]).map((faculty) => ({
      ...faculty,
      archivedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
      studentCount: 0,
      departmentCount: 0,
      universities: [],
    })),
    50,
  );

interface Routes {
  departments?: unknown[];
  mutation?: (url: string, method: string) => Response | undefined;
  universities?: () => Response;
  faculties?: (url: string) => Response;
  one?: () => Response;
}

const route = (routes: Routes = {}) => {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const custom = routes.mutation?.(url, method);
    if (custom !== undefined) return custom;
    if (url.includes("/directory/universities"))
      return (routes.universities ?? universityOptions)();
    if (url.includes("/directory/faculties")) return (routes.faculties ?? facultyOptions)(url);
    if (method === "GET" && /departments\/[^/?]+$/.test(url) && routes.one) return routes.one();
    return page(routes.departments ?? rows);
  });
};

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
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <QueryClientProvider client={client}>
          <DepartmentsView />
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

const trigger = (scope: ParentNode, label: string): HTMLElement => {
  const labelled = [...scope.querySelectorAll<HTMLElement>("[data-slot=select-trigger]")].find(
    (item) => {
      const ids = item.getAttribute("aria-labelledby");
      const byLabel = ids ? document.getElementById(ids)?.textContent : null;
      const own = item.id ? document.querySelector(`label[for="${item.id}"]`)?.textContent : null;
      return (byLabel ?? own) === label;
    },
  );
  if (!labelled) throw new Error(`No select labelled ${label}`);
  return labelled;
};

const disabled = (element: HTMLElement): boolean =>
  element.hasAttribute("disabled") ||
  element.hasAttribute("data-disabled") ||
  element.getAttribute("aria-disabled") === "true";

const openListbox = (): Element | undefined =>
  [...document.querySelectorAll("[role=listbox]")].pop();

const options = () =>
  [...(openListbox()?.querySelectorAll("[role=option]") ?? [])].map((item) => item.textContent);

async function openSelect(scope: ParentNode, label: string) {
  await act(async () => {
    const element = trigger(scope, label);
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    element.click();
  });
}

async function pick(scope: ParentNode, label: string, option: string) {
  await openSelect(scope, label);
  await vi.waitFor(() => expect(options()).toContain(option));
  await act(async () => {
    const item = [...(openListbox()?.querySelectorAll<HTMLElement>("[role=option]") ?? [])].find(
      (candidate) => candidate.textContent === option,
    );
    item?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse" }));
    item?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    item?.click();
  });
}

const callsTo = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method);

const urlsOf = (method: string) => callsTo(method).map(([input]) => String(input));

const listCalls = () =>
  fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/directory/departments"));

describe("DepartmentsView list", () => {
  test("lists departments with their university, faculty and students and asks for the first page", async () => {
    route();

    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Anthropology"));

    expect(rowOf(view, "Anthropology")?.textContent).toContain("University of Dhaka");
    expect(rowOf(view, "Anthropology")?.textContent).toContain("Faculty of Arts");
    expect(rowOf(view, "Anthropology")?.textContent).toContain("3");
    expect(rowOf(view, "Physics")?.textContent).toContain("Faculty of Engineering");
    expect(listCalls()[0]).toBe(
      "/api/admin/directory/departments?status=active&page=1&pageSize=25",
    );
  });

  test("sends the search text, sort and filters from the URL", async () => {
    route({ departments: [] });

    await mount(`?q=ben&sort=name.desc&university=${dhaka.id}&faculty=${arts.id}`);

    await vi.waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    const url = listCalls()[0] ?? "";
    expect(url).toContain("q=ben");
    expect(url).toContain(`universityId=${dhaka.id}`);
    expect(url).toContain(`facultyId=${arts.id}`);
  });

  test("shows an empty state and an error with retry", async () => {
    route({ departments: [] });
    const empty = await mount();
    await vi.waitFor(() => expect(empty.textContent).toContain("No departments yet"));
    await act(async () => root?.unmount());
    container?.remove();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(errorReply("INTERNAL", 500));
    const failed = await mount();
    await vi.waitFor(() => expect(failed.querySelector("[role=alert]")).not.toBeNull());
  });
});

describe("DepartmentsView filters", () => {
  test("the faculty filter is off until a university is chosen, then offers only that university's faculties", async () => {
    route();
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Anthropology"));
    expect(disabled(trigger(view, "Faculty"))).toBe(true);

    await pick(view, "University", "BUET");

    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain(
        `/api/admin/directory/faculties?page=1&pageSize=50&sort=name&status=all&universityId=${buet.id}`,
      ),
    );
    await vi.waitFor(() =>
      expect(listCalls().some((url) => url.includes(`universityId=${buet.id}`))).toBe(true),
    );
    await openSelect(view, "Faculty");
    await vi.waitFor(() => expect(options()).toEqual(["All faculties", "Faculty of Engineering"]));
  });
});

describe("DepartmentsView filter truncation", () => {
  test("the university filter says when more universities exist than it lists", async () => {
    route({ universities: () => json({ items: [], total: 51, page: 1, pageSize: 50 }) });

    const view = await mount();

    await vi.waitFor(() =>
      expect(view.textContent).toContain("Only the first 50 names are listed"),
    );
  });

  test("the faculty filter says when more faculties exist than it lists", async () => {
    route({ faculties: () => json({ items: [], total: 51, page: 1, pageSize: 50 }) });

    const view = await mount(`?university=${dhaka.id}`);

    await vi.waitFor(() =>
      expect(view.textContent).toContain("Only the first 50 names are listed"),
    );
  });

  test("no notice while every name fits", async () => {
    route();

    const view = await mount(`?university=${dhaka.id}`);
    await vi.waitFor(() => expect(view.textContent).toContain("Anthropology"));

    expect(view.textContent).not.toContain("Only the first");
  });
});

describe("DepartmentsView orphan faculty link", () => {
  test("a faculty in the URL without a university is not sent to the API", async () => {
    route();

    await mount(`?faculty=${arts.id}`);

    await vi.waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    expect(listCalls().every((url) => !url.includes("facultyId"))).toBe(true);
  });
});

describe("DepartmentsView cascade", () => {
  test("changing the university clears the faculty filter", async () => {
    route();
    const view = await mount(`?university=${dhaka.id}&faculty=${arts.id}`);
    await vi.waitFor(() =>
      expect(listCalls().some((url) => url.includes(`facultyId=${arts.id}`))).toBe(true),
    );

    await pick(view, "University", "BUET");

    await vi.waitFor(() => {
      const latest = listCalls().at(-1) ?? "";
      expect(latest).toContain(`universityId=${buet.id}`);
      expect(latest).not.toContain("facultyId");
    });
  });
});

describe("DepartmentsView form", () => {
  const openCreate = async (view: HTMLElement) => {
    await act(async () => buttonNamed("Add department", view)?.click());
    return document.querySelector("[data-slot=form]") as HTMLElement;
  };

  test("refuses an empty form without calling the API and names what is missing", async () => {
    route();
    const view = await mount();
    await openCreate(view);

    await submitForm();

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Enter the department name."),
    );
    expect(document.body.textContent).toContain("Choose a university.");
    expect(document.body.textContent).toContain("Choose a faculty.");
    expect(callsTo("POST")).toHaveLength(0);
  });

  test("the faculty select is off until a university is chosen and then shows only its faculties", async () => {
    route();
    const view = await mount();
    const form = await openCreate(view);
    expect(disabled(trigger(form, "Faculty"))).toBe(true);

    await pick(form, "University", "BUET");

    await vi.waitFor(() =>
      expect(urlsOf("GET")).toContain(
        `/api/admin/directory/faculties?page=1&pageSize=50&sort=name&universityId=${buet.id}`,
      ),
    );
    await vi.waitFor(() => expect(disabled(trigger(form, "Faculty"))).toBe(false));
    await openSelect(form, "Faculty");
    await vi.waitFor(() => expect(options()).toEqual(["Faculty of Engineering"]));
  });

  test("creates the department under the chosen pair and confirms", async () => {
    route({
      mutation: (_url, method) =>
        method === "POST" ? json(row({ name: "Physics" }), 201) : undefined,
    });
    const view = await mount();
    const form = await openCreate(view);

    await type(document.querySelector("input[name=name]"), "  Physics ");
    await pick(form, "University", "BUET");
    await vi.waitFor(() => expect(disabled(trigger(form, "Faculty"))).toBe(false));
    await pick(form, "Faculty", "Faculty of Engineering");
    await submitForm();

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("Physics was added"),
    );
    expect(JSON.parse(String(callsTo("POST")[0]?.[1]?.body))).toEqual({
      name: "Physics",
      universityId: buet.id,
      facultyId: engineering.id,
    });
    expect(document.querySelector("[data-slot=form]")).toBeNull();
  });

  test("a name that is taken is shown on the field and the sheet stays open with the values", async () => {
    route({
      mutation: (_url, method) =>
        method === "POST" ? errorReply("DIRECTORY_NAME_TAKEN", 409) : undefined,
    });
    const view = await mount();
    const form = await openCreate(view);

    await type(document.querySelector("input[name=name]"), "Anthropology");
    await pick(form, "University", "University of Dhaka");
    await vi.waitFor(() => expect(disabled(trigger(form, "Faculty"))).toBe(false));
    await pick(form, "Faculty", "Faculty of Arts");
    await submitForm();

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        "A department with this name already exists for this university and faculty.",
      ),
    );
    expect(document.querySelector("[data-slot=form]")).not.toBeNull();
    expect((document.querySelector("input[name=name]") as HTMLInputElement).value).toBe(
      "Anthropology",
    );
  });

  test("a server failure is shown in the form and the sheet stays open", async () => {
    route({
      mutation: (_url, method) => (method === "POST" ? errorReply("INTERNAL", 500) : undefined),
    });
    const view = await mount();
    const form = await openCreate(view);
    await type(document.querySelector("input[name=name]"), "Physics");
    await pick(form, "University", "BUET");
    await vi.waitFor(() => expect(disabled(trigger(form, "Faculty"))).toBe(false));
    await pick(form, "Faculty", "Faculty of Engineering");

    await submitForm();

    await vi.waitFor(() =>
      expect(document.querySelector("[data-slot=form-message]")?.textContent).toBeTruthy(),
    );
    expect(document.querySelector("[data-slot=form]")).not.toBeNull();
  });

  test("editing keeps showing an archived university and faculty the pickers no longer offer", async () => {
    const retiredUniversity = {
      id: "0198f1a0-0000-7000-8000-0000000000a9",
      name: "Retired University",
    };
    const retiredFaculty = { id: "0198f1a0-0000-7000-8000-0000000000b9", name: "Retired Faculty" };
    route({
      departments: [
        row({
          id: physics,
          name: "Physics",
          university: retiredUniversity,
          faculty: retiredFaculty,
        }),
      ],
    });
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Physics"));
    await act(async () => buttonNamed("Edit", rowOf(view, "Physics") ?? view)?.click());
    const form = document.querySelector("[data-slot=form]") as HTMLElement;

    await vi.waitFor(() =>
      expect(trigger(form, "University").textContent).toContain("Retired University"),
    );
    await vi.waitFor(() =>
      expect(trigger(form, "Faculty").textContent).toContain("Retired Faculty"),
    );
  });

  test("editing starts from the department's values and saves them", async () => {
    route({
      mutation: (_url, method) =>
        method === "PATCH" ? json(row({ name: "Archaeology" })) : undefined,
    });
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Physics"));
    await act(async () => buttonNamed("Edit", rowOf(view, "Physics") ?? view)?.click());

    expect((document.querySelector("input[name=name]") as HTMLInputElement).value).toBe("Physics");
    await type(document.querySelector("input[name=name]"), "Applied Physics");
    await submitForm();

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("was saved"),
    );
    expect(urlsOf("PATCH")).toEqual([`/api/admin/directory/departments/${physics}`]);
    expect(JSON.parse(String(callsTo("PATCH")[0]?.[1]?.body))).toEqual({
      name: "Applied Physics",
      universityId: buet.id,
      facultyId: engineering.id,
    });
  });

  test("a department with students cannot change its university or faculty", async () => {
    route();
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Anthropology"));
    await act(async () => buttonNamed("Edit", rowOf(view, "Anthropology") ?? view)?.click());

    const form = document.querySelector("[data-slot=form]") as HTMLElement;
    expect(disabled(trigger(form, "University"))).toBe(true);
    expect(disabled(trigger(form, "Faculty"))).toBe(true);
    expect(document.body.textContent).toContain("cannot be moved");
  });

  test("a refused move is explained in the form", async () => {
    route({
      mutation: (_url, method) =>
        method === "PATCH" ? errorReply("DIRECTORY_IN_USE", 409) : undefined,
    });
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Physics"));
    await act(async () => buttonNamed("Edit", rowOf(view, "Physics") ?? view)?.click());

    await submitForm();

    await vi.waitFor(() =>
      expect(document.querySelector("[data-slot=form-message]")?.textContent).toContain(
        "cannot be moved",
      ),
    );
  });

  test("a university list that cannot load is explained, and a university with no faculty says so", async () => {
    route({ universities: () => errorReply("INTERNAL", 500) });
    const view = await mount();
    await openCreate(view);
    await vi.waitFor(() => expect(document.body.textContent).toContain("could not be loaded"));
  });

  test("says when more universities exist than the select lists", async () => {
    route({
      universities: () => json({ items: [], total: 51, page: 1, pageSize: 50 }),
    });
    const view = await mount();

    await openCreate(view);

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("Only the first 50 names are listed"),
    );
  });

  test("closing a form with unsaved changes asks before discarding", async () => {
    route();
    const view = await mount();
    await openCreate(view);
    await type(document.querySelector("input[name=name]"), "Half typed");

    await act(async () => buttonNamed("Cancel")?.click());

    expect(document.body.textContent).toContain("You have unsaved changes");
    await act(async () => buttonNamed("Discard changes")?.click());
    expect(document.querySelector("[data-slot=form]")).toBeNull();
  });
});

describe("DepartmentsView delete", () => {
  const openDelete = async (view: HTMLElement, name: string) => {
    await vi.waitFor(() => expect(view.textContent).toContain(name));
    await act(async () => buttonNamed("Delete", rowOf(view, name) ?? view)?.click());
    return document.querySelector("[data-slot=confirm-dialog]") as HTMLElement;
  };

  test("the confirmation names the department and needs the name typed", async () => {
    route();
    const view = await mount();

    const dialog = await openDelete(view, "Physics");

    const confirm = buttonNamed("Delete department", dialog);
    expect(confirm?.disabled).toBe(true);
    await type(dialog.querySelector("input"), "Physics");
    expect(confirm?.disabled).toBe(false);
  });

  test("deleting an unused department calls the API and confirms", async () => {
    route({
      mutation: (_url, method) =>
        method === "DELETE" ? new Response(null, { status: 204 }) : undefined,
    });
    const view = await mount();
    const dialog = await openDelete(view, "Physics");

    await type(dialog.querySelector("input"), "Physics");
    await act(async () => buttonNamed("Delete department", dialog)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain("Physics was deleted"),
    );
    expect(urlsOf("DELETE")).toEqual([`/api/admin/directory/departments/${physics}`]);
  });

  test("a refused delete explains the current student count and suggests archiving", async () => {
    route({
      mutation: (_url, method) =>
        method === "DELETE" ? errorReply("DIRECTORY_IN_USE", 409) : undefined,
      one: () => json(row({ studentCount: 5 })),
    });
    const view = await mount();
    const dialog = await openDelete(view, "Anthropology");

    await type(dialog.querySelector("input"), "Anthropology");
    await act(async () => buttonNamed("Delete department", dialog)?.click());

    await vi.waitFor(() => expect(dialog.querySelector("[role=alert]")).not.toBeNull());
    const message = dialog.querySelector("[role=alert]")?.textContent;
    expect(message).toContain("5 students");
    expect(message).toContain("Archive it instead");
  });

  test("when the current count cannot be read the listed count is used", async () => {
    route({
      mutation: (_url, method) =>
        method === "DELETE" ? errorReply("DIRECTORY_IN_USE", 409) : undefined,
      one: () => errorReply("INTERNAL", 500),
    });
    const view = await mount();
    const dialog = await openDelete(view, "Anthropology");

    await type(dialog.querySelector("input"), "Anthropology");
    await act(async () => buttonNamed("Delete department", dialog)?.click());

    await vi.waitFor(() =>
      expect(dialog.querySelector("[role=alert]")?.textContent).toContain("3 students"),
    );
  });
});

describe("DepartmentsView archive and restore", () => {
  const archivedAt = "2026-11-02T04:00:00.000Z";
  const archivedRow = row({
    id: "0198f1a0-0000-7000-8000-0000000000d9",
    name: "Retired Department",
    archivedAt,
  });
  const both = {
    departments: [
      row({ id: "0198f1a0-0000-7000-8000-0000000000d1", name: "Anthropology" }),
      archivedRow,
    ],
  };

  test("shows a status badge and the archive and restore actions by state", async () => {
    route(both);
    const view = await mount("?status=all");

    await vi.waitFor(() => expect(view.textContent).toContain("Retired Department"));
    expect(rowOf(view, "Retired Department")?.textContent).toContain("Archived");
    expect(buttonNamed("Restore", rowOf(view, "Retired Department") ?? view)).toBeDefined();
    expect(buttonNamed("Archive", rowOf(view, "Retired Department") ?? view)).toBeUndefined();
    expect(rowOf(view, "Anthropology")?.textContent).toContain("Active");
    expect(buttonNamed("Archive", rowOf(view, "Anthropology") ?? view)).toBeDefined();
  });

  test("the status filter is read from the URL and sent to the API", async () => {
    route({ departments: [] });

    await mount("?status=archived");

    await vi.waitFor(() =>
      expect(listCalls().some((url) => url.includes("status=archived"))).toBe(true),
    );
  });

  test("archiving asks for confirmation, calls the API and confirms", async () => {
    route({
      ...both,
      mutation: (_url, method) =>
        method === "POST"
          ? json(row({ id: "0198f1a0-0000-7000-8000-0000000000d1", archivedAt }))
          : undefined,
    });
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Anthropology"));

    await act(async () => buttonNamed("Archive", rowOf(view, "Anthropology") ?? view)?.click());
    const dialog = document.querySelector("[data-slot=confirm-dialog]") as HTMLElement;
    expect(dialog.textContent).toContain("Anthropology");
    expect(callsTo("POST")).toHaveLength(0);
    await act(async () => buttonNamed("Archive department", dialog)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Anthropology was archived",
      ),
    );
    expect(urlsOf("POST")[0]).toBe(
      "/api/admin/directory/departments/0198f1a0-0000-7000-8000-0000000000d1/archive",
    );
  });

  test("restoring calls the API without a confirmation and confirms", async () => {
    route({
      ...both,
      mutation: (_url, method) =>
        method === "POST"
          ? json(row({ id: "0198f1a0-0000-7000-8000-0000000000d9", name: "Retired Department" }))
          : undefined,
    });
    const view = await mount("?status=archived");
    await vi.waitFor(() => expect(view.textContent).toContain("Retired Department"));

    await act(async () =>
      buttonNamed("Restore", rowOf(view, "Retired Department") ?? view)?.click(),
    );

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Retired Department was restored",
      ),
    );
    expect(urlsOf("POST")[0]).toBe(
      "/api/admin/directory/departments/0198f1a0-0000-7000-8000-0000000000d9/restore",
    );
  });

  test("restoring under an archived parent says it stays hidden, and such a row is badged", async () => {
    route({
      ...both,
      mutation: (_url, method) =>
        method === "POST"
          ? json(row({ id: "0198f1a0-0000-7000-8000-0000000000d9", parentArchived: true }))
          : undefined,
    });
    const view = await mount("?status=archived");
    await vi.waitFor(() => expect(view.textContent).toContain("Retired Department"));

    await act(async () =>
      buttonNamed("Restore", rowOf(view, "Retired Department") ?? view)?.click(),
    );

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "stays hidden from enrollment",
      ),
    );
  });

  test("a department under an archived parent is badged as hidden", async () => {
    route({ departments: [row({ name: "Anthropology", parentArchived: true })] });
    const view = await mount();

    await vi.waitFor(() =>
      expect(rowOf(view, "Anthropology")?.textContent).toContain("Hidden, parent archived"),
    );
  });

  test("a failed restore is reported as a problem", async () => {
    route({
      ...both,
      mutation: (_url, method) => (method === "POST" ? errorReply("INTERNAL", 500) : undefined),
    });
    const view = await mount("?status=archived");
    await vi.waitFor(() => expect(view.textContent).toContain("Retired Department"));

    await act(async () =>
      buttonNamed("Restore", rowOf(view, "Retired Department") ?? view)?.click(),
    );

    await vi.waitFor(() =>
      expect(view.querySelector("[role=alert]")?.textContent).toContain(
        "Retired Department could not be restored",
      ),
    );
  });
});
