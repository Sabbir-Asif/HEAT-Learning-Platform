"use client";

import { useAuditLogList } from "@heat/api-client";
import type { AuditLogListParams, AuditLogListResponseDtoItemsItem } from "@heat/api-client";
import { PageHeader } from "@heat/ui";
import { DataTable, FilterBar, FilterInput, useClampedPage, useTableUrlState } from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { filterIcon } from "../filters/filter-icon";
import { ShellContent } from "@heat/ui/shell";
import { useMemo } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { actorLabel, describeChange } from "./audit-copy";

type AuditRow = AuditLogListResponseDtoItemsItem;

const filterKeys = ["actor", "action", "entity", "from", "to"] as const;

export function AuditLogView() {
  const url = useTableUrlState({ sortable: [], filters: filterKeys });
  const { actor, action, entity, from, to } = url.filters;
  const params: AuditLogListParams = {
    page: url.page,
    pageSize: url.pageSize,
    ...(actor ? { actor } : {}),
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const rangeInvalid = Boolean(from && to && to < from);
  const list = useAuditLogList(params, { query: { enabled: !rangeInvalid } });
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);

  const columns = useMemo<DataTableColumn<AuditRow>[]>(
    () => [
      { id: "occurredAt", header: "When", cell: (row) => formatDhakaTime(row.occurredAt) },
      { id: "actor", header: "Actor", cell: (row) => actorLabel(row.actorEmail, row.actorId) },
      { id: "action", header: "Action", cell: (row) => row.action },
      {
        id: "entity",
        header: "Entity",
        cell: (row) => (row.entityId === null ? row.entity : `${row.entity} ${row.entityId}`),
      },
      {
        id: "changes",
        header: "Changes",
        cell: (row) => describeChange(row.before, row.after),
      },
      { id: "ipAddress", header: "IP address", cell: (row) => row.ipAddress ?? "" },
      { id: "requestId", header: "Request", cell: (row) => row.requestId ?? "" },
    ],
    [],
  );

  const textFilter = (key: "actor" | "action" | "entity", label: string) => (
    <FilterInput
      label={label}
      icon={filterIcon(label)}
      key={url.filters[key]}
      defaultValue={url.filters[key]}
      placeholder="Any"
      onBlur={(event) => {
        const next = event.target.value.trim();
        if (next !== url.filters[key]) url.setFilter(key, next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );

  const dateFilter = (key: "from" | "to", label: string) => (
    <FilterInput
      label={label}
      icon={filterIcon(label)}
      type="date"
      {...(key === "from" && to ? { max: to } : {})}
      {...(key === "to" && from ? { min: from } : {})}
      error={
        key === "to" && rangeInvalid ? "The end date must not be before the start date." : undefined
      }
      value={url.filters[key]}
      onChange={(event) => url.setFilter(key, event.target.value)}
    />
  );

  return (
    <ShellContent>
      <PageHeader title="Audit log" />
      <FilterBar activeCount={url.activeFilterCount} onClear={url.clearFilters}>
        {textFilter("actor", "Actor")}
        {textFilter("action", "Action")}
        {textFilter("entity", "Entity")}
        {dateFilter("from", "From")}
        {dateFilter("to", "To")}
      </FilterBar>
      <DataTable
        label="Audit log"
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.id}
        total={total}
        page={page}
        pageSize={url.pageSize}
        sort={url.sort}
        onToggleSort={url.toggleSort}
        onSortChange={url.setSort}
        onPageChange={url.setPage}
        onPageSizeChange={url.setPageSize}
        status={list.isError ? "error" : list.isPending ? "loading" : "ready"}
        fetching={list.isFetching && !list.isPending}
        onRetry={() => void list.refetch()}
        filtersActive={url.activeFilterCount > 0}
        onClearFilters={url.clearFilters}
        emptyTitle="No audit entries yet"
        emptyDescription="Admin actions are recorded here as they happen."
      />
    </ShellContent>
  );
}
