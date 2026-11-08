"use client";

import { createParser, parseAsString, useQueryStates, type Parser } from "nuqs";
import * as React from "react";
import {
  clampPage,
  defaultPageSize,
  nextSort,
  parsePage,
  parsePageSize,
  parseSort,
  serializeSort,
  type PageSize,
  type SortState,
} from "./url-state";

const pageParser = createParser({
  parse: (value) => parsePage(value),
  serialize: (value) => String(value),
}).withDefault(1);

const pageSizeParser = createParser({
  parse: (value) => parsePageSize(value),
  serialize: (value) => String(value),
}).withDefault(defaultPageSize);

type FilterParsers = Record<string, Parser<string>>;

type UseTableUrlStateOptions = {
  sortable: readonly string[];
  filters?: string[];
};

type TableUrlState = {
  page: number;
  pageSize: PageSize;
  sort: SortState | null;
  query: string;
  filters: Record<string, string>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: PageSize) => void;
  toggleSort: (id: string) => void;
  setQuery: (query: string) => void;
  setFilter: (key: string, value: string | null) => void;
  clearFilters: () => void;
  activeFilterCount: number;
};

function useTableUrlState({ sortable, filters = [] }: UseTableUrlStateOptions): TableUrlState {
  const parsers = React.useMemo(() => {
    const filterParsers: FilterParsers = Object.fromEntries(
      filters.map((key) => [key, parseAsString.withDefault("")]),
    );
    return {
      page: pageParser,
      pageSize: pageSizeParser,
      sort: parseAsString,
      q: parseAsString.withDefault(""),
      ...filterParsers,
    };
  }, [filters]);

  const [state, setState] = useQueryStates(parsers, { history: "push" });

  const pageSize = state.pageSize as PageSize;
  const page = state.page as number;
  const sort = parseSort(state.sort as string | null, sortable);

  const values: Record<string, unknown> = state;
  const filterValues = Object.fromEntries(filters.map((key) => [key, String(values[key] ?? "")]));
  const activeFilterCount = filters.filter((key) => filterValues[key]).length + (state.q ? 1 : 0);

  return {
    page,
    pageSize,
    sort,
    query: state.q as string,
    filters: filterValues,
    setPage: (next) => void setState({ page: next }),
    setPageSize: (next) => void setState({ pageSize: next, page: 1 }),
    toggleSort: (id) =>
      void setState({ sort: serializeSort(nextSort(sort, id)), page: 1 }, { history: "replace" }),
    setQuery: (next) => void setState({ q: next || null, page: 1 }, { history: "replace" }),
    setFilter: (key, value) =>
      void setState({ [key]: value || null, page: 1 }, { history: "replace" }),
    clearFilters: () =>
      void setState({ q: null, page: 1, ...Object.fromEntries(filters.map((key) => [key, null])) }),
    activeFilterCount,
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
