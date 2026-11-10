"use client";

import {
  getFacultiesGetQueryOptions,
  getFacultiesListQueryKey,
  getUniversitiesListQueryKey,
  isApiError,
  useFacultiesArchive,
  useFacultiesList,
  useFacultiesRemove,
  useFacultiesRestore,
} from "@heat/api-client";
import type { FacultyListResponseDtoItemsItem } from "@heat/api-client";
import { facultySortFields } from "@heat/contracts";
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
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
import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { facultyDeleteBlockedMessage } from "./directory-copy";
import {
  archiveFailedMessage,
  directoryStatusItems,
  restoreFailedMessage,
  statusFilterKey,
  statusFilterOptions,
  statusFromUrl,
} from "./directory-status";
import { FacultyFormSheet } from "./faculty-form-sheet";
import type { FacultyFormTarget } from "./faculty-form-sheet";

type FacultyRow = FacultyListResponseDtoItemsItem;

const sortable = ["name", "createdAt"] as const;
const sortValues: readonly string[] = facultySortFields;

export function FacultiesView() {
  const queryClient = useQueryClient();
  const url = useTableUrlState({
    sortable,
    filters: [statusFilterKey],
    filterOptions: statusFilterOptions,
  });
  const [target, setTarget] = useState<FacultyFormTarget>(null);
  const [notice, setNotice] = useState<{ text: string; problem: boolean } | null>(null);
  const [blocked, setBlocked] = useState<{ id: string; message: string } | null>(null);
  const sortValue = url.sort ? `${url.sort.desc ? "-" : ""}${url.sort.id}` : undefined;
  const status = statusFromUrl(url.filters[statusFilterKey]);
  const params = {
    status,
    page: url.page,
    pageSize: url.pageSize,
    ...(sortValue !== undefined && sortValues.includes(sortValue)
      ? { sort: sortValue as (typeof facultySortFields)[number] }
      : {}),
    ...(url.query ? { q: url.query } : {}),
  };
  const list = useFacultiesList(params);
  const remove = useFacultiesRemove();
  const archive = useFacultiesArchive();
  const restore = useFacultiesRestore();
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getFacultiesListQueryKey().slice(0, 1) }),
      queryClient.invalidateQueries({ queryKey: getUniversitiesListQueryKey().slice(0, 1) }),
    ]);

  const columns = useMemo<DataTableColumn<FacultyRow>[]>(
    () => [
      { id: "name", header: "Name", cell: (row) => row.name, sortable: true },
      {
        id: "status",
        header: "Status",
        cell: (row) =>
          row.archivedAt === null ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="outline">Archived</Badge>
          ),
      },
      {
        id: "universities",
        header: "Universities",
        cell: (row) =>
          row.universities.length === 0
            ? "None"
            : row.universities.map((university) => university.name).join(", "),
      },
      { id: "departments", header: "Departments", cell: (row) => String(row.departmentCount) },
      { id: "students", header: "Students", cell: (row) => String(row.studentCount) },
      {
        id: "createdAt",
        header: "Added",
        cell: (row) => formatDhakaTime(row.createdAt),
        sortable: true,
      },
    ],
    [],
  );

  function actions(row: FacultyRow) {
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
        {row.archivedAt === null ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <ArchiveIcon data-icon="inline-start" />
                Archive
              </Button>
            }
            title="Archive this faculty?"
            itemName={row.name}
            description="It and every department under it stop being offered to new students, and it cannot be assigned to a university until restored. Existing students keep it."
            confirmLabel="Archive faculty"
            errorMessage={archiveFailedMessage(row.name)}
            onConfirm={async () => {
              setNotice(null);
              await archive.mutateAsync({ id: row.id });
              await refresh();
              setNotice({ text: `${row.name} was archived.`, problem: false });
            }}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={restore.isPending}
            onClick={async () => {
              setNotice(null);
              try {
                await restore.mutateAsync({ id: row.id });
                await refresh();
                setNotice({ text: `${row.name} was restored.`, problem: false });
              } catch {
                setNotice({ text: restoreFailedMessage(row.name), problem: true });
              }
            }}
          >
            <ArchiveRestoreIcon data-icon="inline-start" />
            Restore
          </Button>
        )}
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm">
              <Trash2Icon data-icon="inline-start" />
              Delete
            </Button>
          }
          title="Delete this faculty?"
          itemName={row.name}
          confirmationName={row.name}
          description="This removes it from the directory for good. Faculties that universities or students use cannot be deleted."
          confirmLabel="Delete faculty"
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
                  .fetchQuery({ ...getFacultiesGetQueryOptions(row.id), staleTime: 0 })
                  .catch(() => row);
                setBlocked({
                  id: row.id,
                  message: facultyDeleteBlockedMessage(row.name, {
                    studentCount: current.studentCount,
                    departmentCount: current.departmentCount,
                    universityCount: current.universities.length,
                  }),
                });
                void refresh();
              }
              throw error;
            }
            await refresh();
            setNotice({ text: `${row.name} was deleted.`, problem: false });
          }}
        />
      </>
    );
  }

  return (
    <ShellContent>
      <PageHeader
        title="Faculties"
        action={
          <Button
            onClick={() => {
              setNotice(null);
              setTarget("create");
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Add faculty
          </Button>
        }
      />
      {notice !== null ? (
        <FieldDescription role={notice.problem ? "alert" : "status"}>
          {notice.text}
        </FieldDescription>
      ) : null}
      <FilterBar
        activeCount={url.activeFilterCount}
        onClear={url.clearFilters}
        search={
          <Input
            type="search"
            aria-label="Search faculties"
            placeholder="Search by name"
            defaultValue={url.query}
            onChange={(event) => url.setQuery(event.target.value.trim())}
          />
        }
      >
        <Field>
          <FieldLabel id="faculty-filter-status">Status</FieldLabel>
          <Select
            items={directoryStatusItems}
            value={status}
            onValueChange={(value) =>
              url.setFilter(statusFilterKey, value === "active" ? null : value)
            }
          >
            <SelectTrigger aria-labelledby="faculty-filter-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {directoryStatusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FilterBar>
      <DataTable
        label="Faculties"
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
        emptyTitle="No faculties yet"
        emptyDescription="Add a faculty, then choose which universities offer it."
        actions={actions}
      />
      <FacultyFormSheet
        target={target}
        onClose={() => setTarget(null)}
        onSaved={async (text, problem) => {
          await refresh();
          setNotice({ text, problem });
        }}
      />
    </ShellContent>
  );
}
