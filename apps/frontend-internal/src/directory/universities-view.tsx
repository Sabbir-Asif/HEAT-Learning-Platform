"use client";

import {
  getUniversitiesGetQueryOptions,
  getUniversitiesListQueryKey,
  isApiError,
  useUniversitiesList,
  useUniversitiesRemove,
} from "@heat/api-client";
import type { UniversityListResponseDtoItemsItem } from "@heat/api-client";
import { universitySortFields } from "@heat/contracts";
import { Button, ConfirmDialog, FieldDescription, Input, PageHeader } from "@heat/ui";
import { DataTable, FilterBar, useClampedPage, useTableUrlState } from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { deleteBlockedMessage } from "./directory-copy";
import { UniversityFormSheet } from "./university-form-sheet";
import type { UniversityFormTarget } from "./university-form-sheet";

type UniversityRow = UniversityListResponseDtoItemsItem;

const sortable = ["name", "createdAt"] as const;
const sortValues: readonly string[] = universitySortFields;

export function UniversitiesView() {
  const queryClient = useQueryClient();
  const url = useTableUrlState({ sortable });
  const [target, setTarget] = useState<UniversityFormTarget>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ id: string; message: string } | null>(null);
  const sortValue = url.sort ? `${url.sort.desc ? "-" : ""}${url.sort.id}` : undefined;
  const params = {
    page: url.page,
    pageSize: url.pageSize,
    ...(sortValue !== undefined && sortValues.includes(sortValue)
      ? { sort: sortValue as (typeof universitySortFields)[number] }
      : {}),
    ...(url.query ? { q: url.query } : {}),
  };
  const list = useUniversitiesList(params);
  const remove = useUniversitiesRemove();
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getUniversitiesListQueryKey().slice(0, 1) });

  const columns = useMemo<DataTableColumn<UniversityRow>[]>(
    () => [
      { id: "name", header: "Name", cell: (row) => row.name, sortable: true },
      { id: "students", header: "Students", cell: (row) => String(row.studentCount) },
      { id: "departments", header: "Departments", cell: (row) => String(row.departmentCount) },
      { id: "faculties", header: "Faculties", cell: (row) => String(row.facultyCount) },
      {
        id: "createdAt",
        header: "Added",
        cell: (row) => formatDhakaTime(row.createdAt),
        sortable: true,
      },
    ],
    [],
  );

  function actions(row: UniversityRow) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setNotice(null);
            setTarget(row);
          }}
        >
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm">
              <Trash2Icon data-icon="inline-start" />
              Delete
            </Button>
          }
          title="Delete this university?"
          itemName={row.name}
          confirmationName={row.name}
          description="This removes it from the directory for good. Universities that students or departments use cannot be deleted."
          confirmLabel="Delete university"
          destructive
          errorMessage={
            blocked?.id === row.id
              ? blocked.message
              : `${row.name} could not be deleted. Try again.`
          }
          onConfirm={async () => {
            setNotice(null);
            setBlocked(null);
            try {
              await remove.mutateAsync({ id: row.id });
            } catch (error) {
              if (isApiError(error) && error.code === "DIRECTORY_IN_USE") {
                const current = await queryClient
                  .fetchQuery({ ...getUniversitiesGetQueryOptions(row.id), staleTime: 0 })
                  .catch(() => row);
                setBlocked({ id: row.id, message: deleteBlockedMessage(row.name, current) });
                void refresh();
              }
              throw error;
            }
            await refresh();
            setNotice(`${row.name} was deleted.`);
          }}
        />
      </>
    );
  }

  return (
    <ShellContent>
      <PageHeader
        title="Universities"
        action={
          <Button
            onClick={() => {
              setNotice(null);
              setTarget("create");
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Add university
          </Button>
        }
      />
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <FilterBar
        activeCount={url.activeFilterCount}
        onClear={url.clearFilters}
        search={
          <Input
            type="search"
            aria-label="Search universities"
            placeholder="Search by name"
            defaultValue={url.query}
            onChange={(event) => url.setQuery(event.target.value.trim())}
          />
        }
      >
        {null}
      </FilterBar>
      <DataTable
        label="Universities"
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
        emptyTitle="No universities yet"
        emptyDescription="Add a university so students can choose it when they enroll."
        actions={actions}
      />
      <UniversityFormSheet
        target={target}
        onClose={() => setTarget(null)}
        onSaved={async (message) => {
          await refresh();
          setNotice(message);
        }}
      />
    </ShellContent>
  );
}
