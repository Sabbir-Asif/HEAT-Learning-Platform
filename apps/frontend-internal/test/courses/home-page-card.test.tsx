import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HomePageCard } from "../../src/courses/home-page-card";

const frontpage = { id: "tag-front", slug: "frontpage", name: "Front page", isSystem: true };
const other = { id: "tag-other", slug: "safety", name: "Safety", isSystem: false };

const state = vi.hoisted(() => ({
  assigned: [] as Array<{ id: string; slug: string }>,
  mutateAsync: vi.fn(),
}));

vi.mock("@heat/api-client", () => ({
  getTagAssignmentsCourseTagsQueryKey: (id: string) => ["course-tags", id],
  useTagsList: () => ({
    isPending: false,
    isError: false,
    data: { items: [frontpage, other] },
  }),
  useTagAssignmentsCourseTags: () => ({
    isPending: false,
    isError: false,
    data: { items: state.assigned },
  }),
  useTagAssignmentsSetCourseTags: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLElement | undefined;

beforeEach(() => {
  state.assigned = [];
  state.mutateAsync = vi.fn().mockResolvedValue({ items: [] });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
});

const show = (published: boolean) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<HomePageCard courseId="course-1" published={published} />));
};

const checkbox = (): HTMLElement => {
  const element = container?.querySelector<HTMLElement>('[role="checkbox"]');
  if (!element) throw new Error("checkbox missing");
  return element;
};

describe("HomePageCard", () => {
  test("ticking the box adds the frontpage tag and keeps the other tags", async () => {
    state.assigned = [{ id: other.id, slug: other.slug }];
    show(true);
    await act(async () => checkbox().click());
    expect(state.mutateAsync).toHaveBeenCalledWith({
      id: "course-1",
      data: { tagIds: [other.id, frontpage.id] },
    });
  });

  test("clearing the box removes only the frontpage tag", async () => {
    state.assigned = [
      { id: frontpage.id, slug: frontpage.slug },
      { id: other.id, slug: other.slug },
    ];
    show(true);
    expect(checkbox().getAttribute("aria-checked")).toBe("true");
    await act(async () => checkbox().click());
    expect(state.mutateAsync).toHaveBeenCalledWith({
      id: "course-1",
      data: { tagIds: [other.id] },
    });
  });

  test("a draft course says it appears once published", () => {
    show(false);
    expect(container?.textContent).toContain("once it is published");
  });

  test("tells the admin when the setting could not be saved", async () => {
    state.mutateAsync = vi.fn().mockRejectedValue(new Error("fail"));
    show(true);
    await act(async () => checkbox().click());
    expect(container?.textContent).toContain("could not be saved");
  });
});
