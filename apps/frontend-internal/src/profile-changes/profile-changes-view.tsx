"use client";

import { getProfileChangeAdminListQueryKey, useProfileChangeAdminList } from "@heat/api-client";
import {
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@heat/ui";
import { DataTable, FilterBar, useClampedPage, useTableUrlState } from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { DecisionSheet } from "./decision-sheet";
import type { DecisionTarget } from "./decision-sheet";
import {
  changeLines,
  emptyCopy,
  statusFilterItems,
  statusLabel,
  statusParam,
  toStatusFilter,
} from "./profile-changes-copy";
import type { ProfileChangeRow } from "./profile-changes-copy";

const filterKeys = ["status"] as const;

export function ProfileChangesView() {
  const queryClient = useQueryClient();
  const url = useTableUrlState({ sortable: [], filters: filterKeys });
  const [target, setTarget] = useState<DecisionTarget>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const status = toStatusFilter(url.filters["status"] ?? "");
  const list = useProfileChangeAdminList({
    status: statusParam(status),
    page: url.page,
    pageSize: url.pageSize,
  });
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);
  const items = list.data?.items;
  const rows = useMemo(() => items ?? [], [items]);

  const columns = useMemo<DataTableColumn<ProfileChangeRow>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        cell: (row) => (
          <div className="flex flex-col">
            <strong>{row.student.name}</strong>
            <FieldDescription>{row.student.email}</FieldDescription>
          </div>
        ),
      },
      {
        id: "changes",
        header: "Requested changes",
        cell: (row) => (
          <ul className="flex flex-col gap-1">
            {changeLines(row).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ),
      },
      { id: "note", header: "Note", cell: (row) => row.note ?? "None" },
      { id: "submitted", header: "Submitted", cell: (row) => formatDhakaTime(row.createdAt) },
      {
        id: "decision",
        header: "Decision",
        cell: (row) =>
          row.status === "REJECTED" && row.reason !== null
            ? `${statusLabel[row.status]}: ${row.reason}`
            : statusLabel[row.status],
      },
    ],
    [],
  );

  return (
    <ShellContent>
      <PageHeader title="Profile changes" />
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <FilterBar activeCount={url.activeFilterCount} onClear={url.clearFilters}>
        <Field>
          <FieldLabel id="profile-changes-status">Status</FieldLabel>
          <Select
            items={statusFilterItems}
            value={status}
            onValueChange={(next) => url.setFilter("status", next === "pending" ? null : next)}
          >
            <SelectTrigger aria-labelledby="profile-changes-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FilterBar>
      <DataTable
        label="Profile change requests"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        total={total}
        page={page}
        pageSize={url.pageSize}
        sort={null}
        onToggleSort={url.toggleSort}
        onSortChange={url.setSort}
        onPageChange={url.setPage}
        onPageSizeChange={url.setPageSize}
        status={list.isError ? "error" : list.isPending ? "loading" : "ready"}
        fetching={list.isFetching && !list.isPending}
        onRetry={() => void list.refetch()}
        filtersActive={url.activeFilterCount > 0}
        onClearFilters={url.clearFilters}
        emptyTitle={emptyCopy[status].title}
        emptyDescription={emptyCopy[status].description}
        actions={
          status === "pending"
            ? (row) => (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setNotice(null);
                      setTarget({ row, mode: "approve" });
                    }}
                  >
                    <CheckIcon data-icon="inline-start" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNotice(null);
                      setTarget({ row, mode: "reject" });
                    }}
                  >
                    <XIcon data-icon="inline-start" />
                    Reject
                  </Button>
                </div>
              )
            : undefined
        }
      />
      <DecisionSheet
        target={target}
        onClose={() => setTarget(null)}
        onDecided={(message) => {
          setTarget(null);
          setNotice(message);
          void queryClient.invalidateQueries({
            queryKey: getProfileChangeAdminListQueryKey().slice(0, 1),
          });
        }}
      />
    </ShellContent>
  );
}
