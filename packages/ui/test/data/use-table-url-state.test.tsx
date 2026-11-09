import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { describe, expect, test, vi } from "vitest";
import { useClampedPage, useTableUrlState } from "../../src/data/use-table-url-state";

const filters = ["status"];
const filterOptions = { status: ["approved", "pending"] };

function setup(searchParams = "") {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  const wrapper = withNuqsTestingAdapter({ searchParams, hasMemory: true, onUrlUpdate });
  const hook = renderHook(
    () => useTableUrlState({ sortable: ["name", "joined"], filters, filterOptions }),
    { wrapper },
  );
  const last = () => onUrlUpdate.mock.calls.at(-1)?.[0];
  return { ...hook, onUrlUpdate, last };
}

describe("reading the URL", () => {
  test("uses defaults for an empty URL", () => {
    const { result } = setup();
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.sort).toBeNull();
    expect(result.current.query).toBe("");
    expect(result.current.activeFilterCount).toBe(0);
  });

  test("reads every key", () => {
    const { result } = setup("?page=3&pageSize=10&sort=-name&q=ana&status=pending");
    expect(result.current.page).toBe(3);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.sort).toEqual({ id: "name", desc: true });
    expect(result.current.query).toBe("ana");
    expect(result.current.filters).toEqual({ status: "pending" });
    expect(result.current.activeFilterCount).toBe(2);
  });

  test("falls back for invalid values and clears them from the URL", async () => {
    const { result, last } = setup("?page=-3&pageSize=7&sort=email&status=bogus&q=keep");
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.sort).toBeNull();
    expect(result.current.filters.status).toBe("");
    await waitFor(() => expect(last()).toBeDefined());
    expect(last()?.searchParams.toString()).toBe("q=keep");
    expect(last()?.options.history).toBe("replace");
  });

  test("leaves a valid URL alone", () => {
    const { onUrlUpdate } = setup("?page=2&pageSize=50&sort=name&status=approved");
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe("writing the URL", () => {
  test("setPage pushes history and drops page 1 from the URL", async () => {
    const { result, last } = setup();
    act(() => result.current.setPage(2));
    await waitFor(() => expect(last()?.queryString).toBe("?page=2"));
    expect(last()?.options.history).toBe("push");
    act(() => result.current.setPage(1));
    await waitFor(() => expect(last()?.queryString).toBe(""));
  });

  test("changing the page size resets the page and omits the default size", async () => {
    const { result, last } = setup("?page=4");
    act(() => result.current.setPageSize(50));
    await waitFor(() => expect(last()?.queryString).toBe("?pageSize=50"));
    act(() => result.current.setPageSize(25));
    await waitFor(() => expect(last()?.queryString).toBe(""));
  });

  test("sorting cycles ascending, descending, none and resets the page", async () => {
    const { result, last } = setup("?page=3");
    act(() => result.current.toggleSort("name"));
    await waitFor(() => expect(last()?.queryString).toBe("?sort=name"));
    expect(last()?.options.history).toBe("push");
    act(() => result.current.toggleSort("name"));
    await waitFor(() => expect(last()?.queryString).toBe("?sort=-name"));
    act(() => result.current.toggleSort("name"));
    await waitFor(() => expect(last()?.queryString).toBe(""));
  });

  test("setSort writes a chosen sort", async () => {
    const { result, last } = setup();
    act(() => result.current.setSort({ id: "joined", desc: true }));
    await waitFor(() => expect(last()?.queryString).toBe("?sort=-joined"));
  });

  test("search replaces history and resets the page", async () => {
    const { result, last } = setup("?page=3");
    act(() => result.current.setQuery("ana"));
    await waitFor(() => expect(last()?.queryString).toBe("?q=ana"));
    expect(last()?.options.history).toBe("replace");
  });

  test("a filter pushes history and resets the page", async () => {
    const { result, last } = setup("?page=3");
    act(() => result.current.setFilter("status", "pending"));
    await waitFor(() => expect(last()?.queryString).toBe("?status=pending"));
    expect(last()?.options.history).toBe("push");
  });

  test("clearing removes the search and every filter but keeps sort and size", async () => {
    const { result, last } = setup("?page=2&pageSize=10&sort=name&q=ana&status=pending");
    act(() => result.current.clearFilters());
    await waitFor(() => expect(last()?.queryString).toBe("?pageSize=10&sort=name"));
  });
});

describe("useClampedPage", () => {
  test("moves a page beyond the end to the last page", async () => {
    const setPage = vi.fn();
    const { result } = renderHook(() => useClampedPage(9, 25, 134, setPage));
    expect(result.current).toBe(6);
    await waitFor(() => expect(setPage).toHaveBeenCalledWith(6));
  });

  test("leaves the page alone while the total is unknown", () => {
    const setPage = vi.fn();
    const { result } = renderHook(() => useClampedPage(4, 25, 0, setPage));
    expect(result.current).toBe(1);
    expect(setPage).not.toHaveBeenCalled();
  });

  test("leaves a valid page alone", () => {
    const setPage = vi.fn();
    renderHook(() => useClampedPage(2, 25, 134, setPage));
    expect(setPage).not.toHaveBeenCalled();
  });
});
