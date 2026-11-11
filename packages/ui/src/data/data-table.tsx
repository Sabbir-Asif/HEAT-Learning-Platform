"use client";

import * as React from "react";
import { createColumnHelper, tableFeatures, useTable, type RowData } from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  InboxIcon,
  SearchXIcon,
  XIcon,
} from "lucide-react";
import { Button } from "../components/button";
import { Checkbox } from "../components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import { Skeleton } from "../components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/table";
import { EmptyState } from "../composites/empty-state";
import { ErrorState } from "../composites/error-state";
import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";
import { Pagination } from "./pagination";
import { pageSelectionState, toggleId, togglePage } from "./selection";
import type { PageSize, SortState } from "./url-state";

type DataTableColumn<Row extends RowData> = {
  id: string;
  header: string;
  cell: (row: Row) => React.ReactNode;
  sortable?: boolean;
};

type DataTableStatus = "ready" | "loading" | "error";

type DataTableSelection<Row extends RowData> = {
  selectedIds: ReadonlySet<string>;
  onSelectedChange: (ids: ReadonlySet<string>) => void;
  rowLabel: (row: Row) => string;
};

type DataTableProps<Row extends RowData> = {
  label: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  total: number;
  page: number;
  pageSize: PageSize;
  sort: SortState | null;
  onToggleSort: (id: string) => void;
  onSortChange: (sort: SortState | null) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  status?: DataTableStatus;
  fetching?: boolean;
  onRetry?: () => void;
  filtersActive?: boolean;
  onClearFilters?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: (row: Row) => React.ReactNode;
  selection?: DataTableSelection<Row>;
  className?: string;
};

const features = tableFeatures({});

const loadingRows = 5;

function DataTable<Row extends RowData>({
  label,
  columns,
  rows,
  getRowId,
  total,
  page,
  pageSize,
  sort,
  onToggleSort,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  status = "ready",
  fetching = false,
  onRetry,
  filtersActive = false,
  onClearFilters,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  actions,
  selection,
  className,
}: DataTableProps<Row>) {
  const isMobile = useIsMobile();

  const tableColumns = React.useMemo(() => {
    const helper = createColumnHelper<typeof features, Row>();
    return helper.columns(
      columns.map((column) =>
        helper.display({
          id: column.id,
          header: column.header,
          cell: ({ row }) => column.cell(row.original),
        }),
      ),
    );
  }, [columns]);

  const sortableIds = new Set(
    columns.filter((column) => column.sortable).map((column) => column.id),
  );

  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId,
  });

  if (status === "error") {
    return <ErrorState onRetry={onRetry} className={className} />;
  }

  const hasActions = actions !== undefined;
  const pageIds = rows.map((row) => getRowId(row));
  const pageState = selection ? pageSelectionState(selection.selectedIds, pageIds) : "none";
  const selectAll = selection ? (
    <Checkbox
      aria-label="Select all on this page"
      checked={pageState === "all"}
      indeterminate={pageState === "some"}
      onCheckedChange={() => selection.onSelectedChange(togglePage(selection.selectedIds, pageIds))}
    />
  ) : null;
  const rowCheckbox = (row: Row) =>
    selection ? (
      <Checkbox
        aria-label={selection.rowLabel(row)}
        checked={selection.selectedIds.has(getRowId(row))}
        onCheckedChange={() =>
          selection.onSelectedChange(toggleId(selection.selectedIds, getRowId(row)))
        }
      />
    ) : null;

  const body =
    status === "loading" ? (
      <LoadingRows
        columns={columns.length + (hasActions ? 1 : 0) + (selection ? 1 : 0)}
        mobile={isMobile}
      />
    ) : rows.length === 0 ? (
      <EmptyRows
        filtersActive={filtersActive}
        onClearFilters={onClearFilters}
        title={emptyTitle}
        description={emptyDescription}
      />
    ) : isMobile ? (
      <div className="flex flex-col gap-3">
        {sortableIds.size > 0 ? (
          <MobileSort columns={columns} sort={sort} onSortChange={onSortChange} />
        ) : null}
        {selection ? (
          <div className="flex items-center gap-2 text-sm">
            {selectAll}
            <span>Select all on this page</span>
          </div>
        ) : null}
        <ul className="flex flex-col gap-3" aria-label={label}>
          {table.getRowModel().rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 rounded-lg border p-3">
              {selection ? (
                <div className="flex items-center">{rowCheckbox(row.original)}</div>
              ) : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {row.getAllCells().map((cell) => (
                  <React.Fragment key={cell.id}>
                    <dt className="text-muted-foreground">
                      {String(cell.column.columnDef.header)}
                    </dt>
                    <dd className="min-w-0 break-words">
                      <table.FlexRender cell={cell} />
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
              {hasActions ? (
                <div className="flex items-center justify-end gap-1">{actions(row.original)}</div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    ) : (
      <Table aria-label={label}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {selection ? <TableHead className="w-8">{selectAll}</TableHead> : null}
              {group.headers.map((header) => {
                const direction =
                  sort?.id === header.column.id ? (sort.desc ? "desc" : "asc") : false;
                const ariaSort =
                  direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
                const Icon =
                  direction === "asc"
                    ? ArrowUpIcon
                    : direction === "desc"
                      ? ArrowDownIcon
                      : ArrowUpDownIcon;
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sortableIds.has(header.column.id) ? ariaSort : undefined}
                  >
                    {sortableIds.has(header.column.id) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleSort(header.column.id)}
                      >
                        {String(header.column.columnDef.header)}
                        <Icon data-icon="inline-end" />
                      </Button>
                    ) : (
                      String(header.column.columnDef.header)
                    )}
                  </TableHead>
                );
              })}
              {hasActions ? (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={selection?.selectedIds.has(row.id) ? "selected" : undefined}
            >
              {selection ? <TableCell>{rowCheckbox(row.original)}</TableCell> : null}
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
              {hasActions ? (
                <TableCell>
                  <div className="flex items-center justify-end gap-1">{actions(row.original)}</div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

  return (
    <div
      data-slot="data-table"
      aria-busy={status === "loading" || fetching}
      className={cn("flex flex-col gap-4", className)}
    >
      {fetching ? (
        <p role="status" className="text-muted-foreground text-xs">
          Updating
        </p>
      ) : null}
      <div>{body}</div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

type MobileSortProps<Row extends RowData> = {
  columns: DataTableColumn<Row>[];
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
};

function MobileSort<Row extends RowData>({ columns, sort, onSortChange }: MobileSortProps<Row>) {
  const items = [
    { value: "", label: "Default order" },
    ...columns
      .filter((column) => column.sortable)
      .flatMap((column) => [
        { value: column.id, label: `${column.header}, ascending` },
        { value: `-${column.id}`, label: `${column.header}, descending` },
      ]),
  ];
  const current = sort ? (sort.desc ? `-${sort.id}` : sort.id) : "";
  return (
    <Select
      items={items}
      value={current}
      onValueChange={(value) => {
        const next = String(value ?? "");
        if (!next) return onSortChange(null);
        const desc = next.startsWith("-");
        onSortChange({ id: desc ? next.slice(1) : next, desc });
      }}
    >
      <SelectTrigger aria-label="Sort by" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LoadingRows({ columns, mobile }: { columns: number; mobile: boolean }) {
  const items = Array.from({ length: loadingRows }, (_, index) => index);
  if (mobile) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading">
        {items.map((item) => (
          <Skeleton key={item} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading">
      {items.map((item) => (
        <div key={item} className="flex gap-3">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

type EmptyRowsProps = {
  filtersActive: boolean;
  onClearFilters?: () => void;
  title: string;
  description?: string;
};

function EmptyRows({ filtersActive, onClearFilters, title, description }: EmptyRowsProps) {
  if (filtersActive) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="No results match the filters"
        description="Change or clear the filters to see more."
        action={
          onClearFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              <XIcon data-icon="inline-start" />
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }
  return <EmptyState icon={InboxIcon} title={title} description={description} />;
}

export { DataTable };
export type { DataTableColumn, DataTableProps, DataTableSelection, DataTableStatus };
