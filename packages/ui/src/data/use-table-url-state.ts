"use client";

import { parseAsString, useQueryStates } from "nuqs";
import * as React from "react";
import {
  clampPage,
  defaultPageSize,
  isValidPage,
  isValidPageSize,
  nextSort,
  parsePage,
  parsePageSize,
  parseSort,
  serializeSort,
  type PageSize,
  type SortState,
} from "./url-state";

type UseTableUrlStateOptions = {
  sortable: readonly string[];
  filters?: readonly string[];
  filterOptions?: Record<string, readonly string[]>;
};

type TableUrlState = {
  page: number;
  pageSize: PageSize;
  sort: SortState | null;
  query: string;
  filters: Record<string, string>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: PageSize) => void;
  setSort: (sort: SortState | null) => void;
  toggleSort: (id: string) => void;
  setQuery: (query: string) => void;
  setFilter: (key: string, value: string | null) => void;
  setFilters: (values: Record<string, string | null>) => void;
  clearFilters: () => void;
  activeFilterCount: number;
};

function useTableUrlState({
  sortable,
  filters = [],
  filterOptions = {},
}: UseTableUrlStateOptions): TableUrlState {
  const filterKey = filters.join(",");
  const parsers = React.useMemo(
    () => ({
      page: parseAsString,
      pageSize: parseAsString,
      sort: parseAsString,
      q: parseAsString,
      ...Object.fromEntries(
        filterKey
          .split(",")
          .filter(Boolean)
          .map((key) => [key, parseAsString]),
      ),
    }),
    [filterKey],
  );

  const [state, setState] = useQueryStates(parsers);
  const raw: Record<string, string | null | undefined> = state;

  const sort = parseSort(raw.sort ?? null, sortable);
  const filterValues = Object.fromEntries(
    filters.map((key) => {
      const value = raw[key] ?? "";
      const allowed = filterOptions[key];
      return [key, allowed && !allowed.includes(value) ? "" : value];
    }),
  );

  const stale: string[] = [];
  if (raw.page != null && !isValidPage(raw.page)) stale.push("page");
  if (raw.pageSize != null && !isValidPageSize(raw.pageSize)) stale.push("pageSize");
  if (raw.sort != null && !sort) stale.push("sort");
  for (const key of filters) {
    if ((raw[key] ?? "") !== filterValues[key]) stale.push(key);
  }
  const staleKeys = stale.join(",");

  React.useEffect(() => {
    if (!staleKeys) return;
    void setState(Object.fromEntries(staleKeys.split(",").map((key) => [key, null])), {
      history: "replace",
    });
  }, [staleKeys, setState]);

  const resetPage = { page: null };
  const push = { history: "push" } as const;

  return {
    page: parsePage(raw.page ?? null),
    pageSize: parsePageSize(raw.pageSize ?? null),
    sort,
    query: raw.q ?? "",
    filters: filterValues,
    setPage: (next) => void setState({ page: next === 1 ? null : String(next) }, push),
    setPageSize: (next) =>
      void setState(
        { pageSize: next === defaultPageSize ? null : String(next), ...resetPage },
        push,
      ),
    setSort: (next) => void setState({ sort: serializeSort(next), ...resetPage }, push),
    toggleSort: (id) =>
      void setState({ sort: serializeSort(nextSort(sort, id)), ...resetPage }, push),
    setQuery: (next) => void setState({ q: next || null, ...resetPage }, { history: "replace" }),
    setFilter: (key, value) => void setState({ [key]: value || null, ...resetPage }, push),
    setFilters: (values) =>
      void setState(
        {
          ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value || null])),
          ...resetPage,
        },
        push,
      ),
    clearFilters: () =>
      void setState(
        { q: null, ...resetPage, ...Object.fromEntries(filters.map((key) => [key, null])) },
        push,
      ),
    activeFilterCount: filters.filter((key) => filterValues[key]).length + (raw.q ? 1 : 0),
  };
}

function useClampedPage(
  page: number,
  pageSize: number,
  total: number,
  setPage: (page: number) => void,
): number {
  const clamped = clampPage(page, total, pageSize);
  React.useEffect(() => {
    if (total > 0 && clamped !== page) setPage(clamped);
  }, [clamped, page, total, setPage]);
  return clamped;
}

export { useClampedPage, useTableUrlState };
export type { TableUrlState, UseTableUrlStateOptions };
