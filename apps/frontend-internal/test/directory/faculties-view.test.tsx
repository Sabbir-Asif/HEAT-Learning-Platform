import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FacultiesView } from "../../src/directory/faculties-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const dhaka = { id: "0198f1a0-0000-7000-8000-0000000000a1", name: "University of Dhaka" };
const buet = { id: "0198f1a0-0000-7000-8000-0000000000a2", name: "BUET" };
const arts = "0198f1a0-0000-7000-8000-0000000000f1";
const science = "0198f1a0-0000-7000-8000-0000000000f2";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: arts,
  name: "Faculty of Arts",
  archivedAt: null,
  createdAt: "2026-11-01T04:00:00.000Z",
  updatedAt: "2026-11-01T04:00:00.000Z",
  studentCount: 0,
  departmentCount: 0,
  universities: [],
  ...overrides,
});

const rows = [
  row({ studentCount: 3, departmentCount: 2, universities: [dhaka] }),
  row({ id: science, name: "Faculty of Science" }),
];

const page = (items: unknown[]) =>
  new Response(JSON.stringify({ items, total: items.length, page: 1, pageSize: 25 }), {
    status: 200,
  });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const errorReply = (code: string, status: number) =>
  json({ error: { code, message: "x", requestId: "r" } }, status);

const universityOptions = () =>
  new Response(
    JSON.stringify({
      items: [dhaka, buet].map((university) => ({
        ...university,
        archivedAt: null,
        createdAt: "2026-11-01T04:00:00.000Z",
        updatedAt: "2026-11-01T04:00:00.000Z",
        studentCount: 0,
        departmentCount: 0,
        facultyCount: 0,
      })),
      total: 2,
      page: 1,
      pageSize: 50,
    }),
    { status: 200 },
  );

interface Routes {
  faculties?: unknown[];
  mutation?: (url: string, method: string) => Response | undefined;
  universities?: () => Response;
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
    if (method === "GET" && /faculties\/[^/?]+$/.test(url) && routes.one) return routes.one();
    return page(routes.faculties ?? rows);
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
      <NuqsTestingAdapter searchParams={searchParams}>
        <QueryClientProvider client={client}>
          <FacultiesView />
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

const checkboxFor = (name: string): HTMLElement | undefined => {
  const label = [...document.querySelectorAll("label")].find((item) =>
    item.textContent?.includes(name),
  );
  return label ? (document.getElementById(label.htmlFor) ?? undefined) : undefined;
};

const toggle = async (name: string) => {
  await vi.waitFor(() => expect(checkboxFor(name)).toBeDefined());
  await act(async () => checkboxFor(name)?.click());
};

const callsTo = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method);

const urlsOf = (method: string) => callsTo(method).map(([input]) => String(input));

describe("FacultiesView list", () => {
  test("lists faculties with their universities and usage and asks for the first page", async () => {
    route();

    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Faculty of Arts"));

    expect(rowOf(view, "Faculty of Arts")?.textContent).toContain("University of Dhaka");
    expect(rowOf(view, "Faculty of Arts")?.textContent).toContain("3");
    expect(rowOf(view, "Faculty of Science")?.textContent).toContain("None");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/admin/directory/faculties?status=active&page=1&pageSize=25",
    );
  });

  test("sends the search text and sort from the URL", async () => {
    route({ faculties: [] });

    await mount("?q=arts&sort=name.desc");

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("q=arts");
  });

  test("shows an empty state and an error with retry", async () => {
    route({ faculties: [] });
    const empty = await mount();
    await vi.waitFor(() => expect(empty.textContent).toContain("No faculties yet"));
    await act(async () => root?.unmount());
    container?.remove();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(errorReply("INTERNAL", 500));
    const failed = await mount();
    await vi.waitFor(() => expect(failed.querySelector("[role=alert]")).not.toBeNull());
  });
});

describe("FacultiesView create", () => {
  test("refuses an empty name without calling the API", async () => {
    route();
    const view = await mount();
    await act(async () => buttonNamed("Add faculty", view)?.click());

    await submitForm();

    await vi.waitFor(() => expect(document.body.textContent).toContain("Enter the faculty name."));
    expect(callsTo("POST")).toHaveLength(0);
  });

  test("offers the universities, creates the faculty and assigns each ticked university", async () => {
    route({
      mutation: (_url, method) =>
        method === "POST"
          ? json(row({ name: "Faculty of Law" }), 201)
          : method === "PUT"
            ? json(row({ name: "Faculty of Law" }))
            : undefined,
    });
    const view = await mount();
    await act(async () => buttonNamed("Add faculty", view)?.click());

    await type(document.querySelector("input[name=name]"), "  Faculty of Law ");
    await toggle("University of Dhaka");
    await toggle("BUET");
    await submitForm();

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Faculty of Law was added",
      ),
    );
    expect(JSON.parse(String(callsTo("POST")[0]?.[1]?.body))).toEqual({ name: "Faculty of Law" });
    expect(urlsOf("PUT").sort()).toEqual(
      [
        `/api/admin/directory/faculties/${arts}/universities/${dhaka.id}`,
        `/api/admin/directory/faculties/${arts}/universities/${buet.id}`,
      ].sort(),
    );
    expect(document.querySelector("[data-slot=form]")).toBeNull();
  });

  test("a name that is taken is shown on the field, nothing is assigned and the sheet stays open", async () => {
    route({
      mutation: (_url, method) =>
        method === "POST" ? errorReply("DIRECTORY_NAME_TAKEN", 409) : undefined,
    });
    const view = await mount();
    await act(async () => buttonNamed("Add faculty", view)?.click());

    await type(document.querySelector("input[name=name]"), "Faculty of Arts");
    await toggle("BUET");
    await submitForm();

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("A faculty with this name already exists."),
    );
    expect(callsTo("PUT")).toHaveLength(0);
    expect(document.querySelector("[data-slot=form]")).not.toBeNull();
  });

  test("a rate limited save shows the wait time and a server failure is shown in the form", async () => {
    route({
      mutation: (_url, method) =>
        method === "POST"
          ? new Response(
              JSON.stringify({ error: { code: "RATE_LIMITED", message: "x", requestId: "r" } }),
              { status: 429, headers: { "retry-after": "120" } },
            )
          : undefined,
    });
    const view = await mount();
    await act(async () => buttonNamed("Add faculty", view)?.click());
    await type(document.querySelector("input[name=name]"), "Anything");
    await submitForm();
    await vi.waitFor(() =>
      expect(document.querySelector("[data-slot=form-message]")?.textContent).toBe(
        "Too many attempts. Try again in 2 minutes.",
      ),
    );

    route({
      mutation: (_url, method) => (method === "POST" ? errorReply("INTERNAL", 500) : undefined),
    });
    await type(document.querySelector("input[name=name]"), "Anything else");
    await submitForm();
    await vi.waitFor(() =>
      expect(document.querySelector("[data-slot=form-message]")?.textContent).not.toContain(
        "Too many",
      ),
    );
    expect(document.querySelector("[data-slot=form]")).not.toBeNull();
  });

  test("a university list that cannot load is explained in the form", async () => {
    route({ universities: () => errorReply("INTERNAL", 500) });
    const view = await mount();

    await act(async () => buttonNamed("Add faculty", view)?.click());

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain("The universities could not be loaded"),
    );
  });

  test("with no universities the form says to add one first", async () => {
    route({
      universities: () =>
        new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 50 }), {
          status: 200,
        }),
    });
    const view = await mount();

    await act(async () => buttonNamed("Add faculty", view)?.click());

    await vi.waitFor(() => expect(document.body.textContent).toContain("No universities yet."));
  });

  test("closing a form with unsaved changes asks before discarding, and keep editing returns", async () => {
    route();
    const view = await mount();
    await act(async () => buttonNamed("Add faculty", view)?.click());
    await act(async () => buttonNamed("Cancel")?.click());
    expect(document.querySelector("[data-slot=form]")).toBeNull();

    await act(async () => buttonNamed("Add faculty", view)?.click());
    await type(document.querySelector("input[name=name]"), "Half typed");
    await act(async () => buttonNamed("Cancel")?.click());
    expect(document.body.textContent).toContain("You have unsaved changes");
    await act(async () => buttonNamed("Keep editing")?.click());
    expect(document.querySelector<HTMLInputElement>("input[name=name]")?.value).toBe("Half typed");
    await act(async () => buttonNamed("Cancel")?.click());
    await act(async () => buttonNamed("Discard changes")?.click());
    expect(document.querySelector("[data-slot=form]")).toBeNull();
  });
});

describe("FacultiesView edit", () => {
  const openEdit = async (view: HTMLElement, name: string) => {
    await vi.waitFor(() => expect(view.textContent).toContain(name));
    await act(async () => buttonNamed("Edit", rowOf(view, name) ?? view)?.click());
  };

  test("pre-fills the name and the linked universities", async () => {
    route();
    const view = await mount();

    await openEdit(view, "Faculty of Arts");

    expect(document.querySelector<HTMLInputElement>("input[name=name]")?.value).toBe(
      "Faculty of Arts",
    );
    await vi.waitFor(() => expect(checkboxFor("BUET")).toBeDefined());
    expect((checkboxFor("University of Dhaka") as HTMLInputElement).checked).toBe(true);
    expect((checkboxFor("BUET") as HTMLInputElement).checked).toBe(false);
  });

  test("renaming sends a PATCH and nothing else when the links are unchanged", async () => {
    route({
      mutation: (_url, method) =>
        method === "PATCH" ? json(row({ name: "Faculty of Letters" })) : undefined,
    });
    const view = await mount();
    await openEdit(view, "Faculty of Arts");

    await type(document.querySelector("input[name=name]"), "Faculty of Letters");
    await submitForm();

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Faculty of Letters was saved",
      ),
    );
    expect(urlsOf("PATCH")).toEqual([`/api/admin/directory/faculties/${arts}`]);
    expect(callsTo("PUT")).toHaveLength(0);
    expect(callsTo("DELETE")).toHaveLength(0);
  });

  test("changing only the links skips the rename, unassigns the cleared one and assigns the new one", async () => {
    route({
      mutation: (_url, method) =>
        method === "PUT" || method === "DELETE" ? json(row()) : undefined,
    });
    const view = await mount();
    await openEdit(view, "Faculty of Arts");

    await toggle("University of Dhaka");
    await toggle("BUET");
    await submitForm();

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Faculty of Arts was saved",
      ),
    );
    expect(callsTo("PATCH")).toHaveLength(0);
    expect(urlsOf("DELETE")).toEqual([
      `/api/admin/directory/faculties/${arts}/universities/${dhaka.id}`,
    ]);
    expect(urlsOf("PUT")).toEqual([
      `/api/admin/directory/faculties/${arts}/universities/${buet.id}`,
    ]);
  });

  test("an unassign the API refuses keeps the sheet open with that university still ticked and the other changes applied", async () => {
    route({
      mutation: (_url, method) =>
        method === "DELETE"
          ? errorReply("DIRECTORY_IN_USE", 409)
          : method === "PUT"
            ? json(row())
            : undefined,
    });
    const view = await mount();
    await openEdit(view, "Faculty of Arts");

    await toggle("University of Dhaka");
    await toggle("BUET");
    await submitForm();

    const message =
      "Faculty of Arts was saved. It still has departments at University of Dhaka, so it was not removed from there.";
    await vi.waitFor(() =>
      expect(document.querySelector("[data-slot=form-message]")?.textContent).toBe(message),
    );
    expect(view.querySelector("[role=alert]")?.textContent).toBe(message);
    expect(callsTo("PUT")).toHaveLength(1);
    expect(document.querySelector("[data-slot=form]")).not.toBeNull();
    expect((checkboxFor("University of Dhaka") as HTMLInputElement).checked).toBe(true);
    expect((checkboxFor("BUET") as HTMLInputElement).checked).toBe(true);
  });

  test("assigning to a university that was archived meanwhile shows the archived message and keeps the sheet open", async () => {
    route({
      mutation: (_url, method) =>
        method === "PUT" ? errorReply("DIRECTORY_ARCHIVED", 409) : undefined,
    });
    const view = await mount();
    await openEdit(view, "Faculty of Science");
    await toggle("BUET");
    await submitForm();

    await vi.waitFor(() =>
      expect(document.querySelector("[data-slot=form-message]")?.textContent).toBe(
        "Faculty of Science was saved. BUET: This record is archived, so it cannot be used for new records. Restore it first.",
      ),
    );
    expect(document.querySelector("[data-slot=form]")).not.toBeNull();
    expect((checkboxFor("BUET") as HTMLInputElement).checked).toBe(true);
  });

  test("a link that cannot be saved keeps the sheet open with it ticked, and a retry only repeats that link", async () => {
    let failing = true;
    route({
      mutation: (_url, method) =>
        method === "PUT" ? (failing ? errorReply("INTERNAL", 500) : json(row())) : undefined,
    });
    const view = await mount();
    await openEdit(view, "Faculty of Science");
    await toggle("BUET");
    await submitForm();

    await vi.waitFor(() =>
      expect(document.querySelector("[data-slot=form-message]")?.textContent).toBe(
        "Faculty of Science was saved. Its link with BUET could not be saved. Try again.",
      ),
    );
    expect((checkboxFor("BUET") as HTMLInputElement).checked).toBe(true);

    failing = false;
    await submitForm();

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Faculty of Science was saved",
      ),
    );
    expect(callsTo("PUT")).toHaveLength(2);
    expect(callsTo("PATCH")).toHaveLength(0);
    expect(document.querySelector("[data-slot=form]")).toBeNull();
  });

  test("when a new faculty is created but a link fails, retrying does not create it again", async () => {
    let failing = true;
    route({
      mutation: (_url, method) =>
        method === "POST"
          ? json(row({ name: "Faculty of Law" }), 201)
          : method === "PUT"
            ? failing
              ? errorReply("INTERNAL", 500)
              : json(row())
            : undefined,
    });
    const view = await mount();
    await act(async () => buttonNamed("Add faculty", view)?.click());
    await type(document.querySelector("input[name=name]"), "Faculty of Law");
    await toggle("BUET");
    await submitForm();
    await vi.waitFor(() =>
      expect(document.querySelector("[data-slot=form-message]")?.textContent).toContain(
        "could not be saved",
      ),
    );

    failing = false;
    await submitForm();

    await vi.waitFor(() => expect(document.querySelector("[data-slot=form]")).toBeNull());
    expect(callsTo("POST")).toHaveLength(1);
    expect(callsTo("PUT")).toHaveLength(2);
  });
});

describe("FacultiesView delete", () => {
  const openDelete = async (view: HTMLElement, name: string) => {
    await vi.waitFor(() => expect(view.textContent).toContain(name));
    await act(async () => buttonNamed("Delete", rowOf(view, name) ?? view)?.click());
    return document.querySelector("[data-slot=confirm-dialog]") as HTMLElement;
  };

  test("the confirmation names the faculty and needs the name typed", async () => {
    route();
    const view = await mount();

    const dialog = await openDelete(view, "Faculty of Science");

    expect(dialog.textContent).toContain("Faculty of Science");
    const confirm = buttonNamed("Delete faculty", dialog);
    expect(confirm?.disabled).toBe(true);
    await type(dialog.querySelector("input"), "Faculty of Science");
    expect(confirm?.disabled).toBe(false);
  });

  test("deleting an unused faculty calls the API and confirms", async () => {
    route({
      mutation: (_url, method) =>
        method === "DELETE" ? new Response(null, { status: 204 }) : undefined,
    });
    const view = await mount();
    const dialog = await openDelete(view, "Faculty of Science");

    await type(dialog.querySelector("input"), "Faculty of Science");
    await act(async () => buttonNamed("Delete faculty", dialog)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Faculty of Science was deleted",
      ),
    );
    expect(urlsOf("DELETE")).toEqual([`/api/admin/directory/faculties/${science}`]);
  });

  test("a refused delete explains the current references and suggests archiving", async () => {
    route({
      mutation: (_url, method) =>
        method === "DELETE" ? errorReply("DIRECTORY_IN_USE", 409) : undefined,
      one: () => json(row({ studentCount: 5, departmentCount: 2, universities: [dhaka, buet] })),
    });
    const view = await mount();
    const dialog = await openDelete(view, "Faculty of Arts");

    await type(dialog.querySelector("input"), "Faculty of Arts");
    await act(async () => buttonNamed("Delete faculty", dialog)?.click());

    await vi.waitFor(() => expect(dialog.querySelector("[role=alert]")).not.toBeNull());
    const message = dialog.querySelector("[role=alert]")?.textContent;
    expect(message).toContain("5 students, 2 departments and 2 university links");
    expect(message).toContain("Archive it instead");
  });

  test("when the current counts cannot be read the listed counts are used", async () => {
    route({
      mutation: (_url, method) =>
        method === "DELETE" ? errorReply("DIRECTORY_IN_USE", 409) : undefined,
      one: () => errorReply("INTERNAL", 500),
    });
    const view = await mount();
    const dialog = await openDelete(view, "Faculty of Arts");

    await type(dialog.querySelector("input"), "Faculty of Arts");
    await act(async () => buttonNamed("Delete faculty", dialog)?.click());

    await vi.waitFor(() =>
      expect(dialog.querySelector("[role=alert]")?.textContent).toContain(
        "3 students, 2 departments",
      ),
    );
  });
});

describe("FacultiesView archive and restore", () => {
  const archivedAt = "2026-11-02T04:00:00.000Z";
  const archivedRow = row({
    id: "0198f1a0-0000-7000-8000-0000000000f9",
    name: "Retired Faculty",
    archivedAt,
  });
  const both = {
    faculties: [
      row({ id: "0198f1a0-0000-7000-8000-0000000000f1", name: "Faculty of Arts" }),
      archivedRow,
    ],
  };

  test("shows a status badge and the archive and restore actions by state", async () => {
    route(both);
    const view = await mount("?status=all");

    await vi.waitFor(() => expect(view.textContent).toContain("Retired Faculty"));
    expect(rowOf(view, "Retired Faculty")?.textContent).toContain("Archived");
    expect(buttonNamed("Restore", rowOf(view, "Retired Faculty") ?? view)).toBeDefined();
    expect(buttonNamed("Archive", rowOf(view, "Retired Faculty") ?? view)).toBeUndefined();
    expect(rowOf(view, "Faculty of Arts")?.textContent).toContain("Active");
    expect(buttonNamed("Archive", rowOf(view, "Faculty of Arts") ?? view)).toBeDefined();
  });

  test("the status filter is read from the URL and sent to the API", async () => {
    route({ faculties: [] });

    await mount("?status=archived");

    await vi.waitFor(() =>
      expect(urlsOf("GET").some((url) => url.includes("status=archived"))).toBe(true),
    );
  });

  test("archiving asks for confirmation, calls the API and confirms", async () => {
    route({
      ...both,
      mutation: (_url, method) =>
        method === "POST"
          ? json(row({ id: "0198f1a0-0000-7000-8000-0000000000f1", archivedAt }))
          : undefined,
    });
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("Faculty of Arts"));

    await act(async () => buttonNamed("Archive", rowOf(view, "Faculty of Arts") ?? view)?.click());
    const dialog = document.querySelector("[data-slot=confirm-dialog]") as HTMLElement;
    expect(dialog.textContent).toContain("Faculty of Arts");
    expect(callsTo("POST")).toHaveLength(0);
    await act(async () => buttonNamed("Archive faculty", dialog)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Faculty of Arts was archived",
      ),
    );
    expect(urlsOf("POST")[0]).toBe(
      "/api/admin/directory/faculties/0198f1a0-0000-7000-8000-0000000000f1/archive",
    );
  });

  test("restoring calls the API without a confirmation and confirms", async () => {
    route({
      ...both,
      mutation: (_url, method) =>
        method === "POST"
          ? json(row({ id: "0198f1a0-0000-7000-8000-0000000000f9", name: "Retired Faculty" }))
          : undefined,
    });
    const view = await mount("?status=archived");
    await vi.waitFor(() => expect(view.textContent).toContain("Retired Faculty"));

    await act(async () => buttonNamed("Restore", rowOf(view, "Retired Faculty") ?? view)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=status]")?.textContent).toContain(
        "Retired Faculty was restored",
      ),
    );
    expect(urlsOf("POST")[0]).toBe(
      "/api/admin/directory/faculties/0198f1a0-0000-7000-8000-0000000000f9/restore",
    );
  });

  test("a failed restore is reported as a problem", async () => {
    route({
      ...both,
      mutation: (_url, method) => (method === "POST" ? errorReply("INTERNAL", 500) : undefined),
    });
    const view = await mount("?status=archived");
    await vi.waitFor(() => expect(view.textContent).toContain("Retired Faculty"));

    await act(async () => buttonNamed("Restore", rowOf(view, "Retired Faculty") ?? view)?.click());

    await vi.waitFor(() =>
      expect(view.querySelector("[role=alert]")?.textContent).toContain(
        "Retired Faculty could not be restored",
      ),
    );
  });
});
