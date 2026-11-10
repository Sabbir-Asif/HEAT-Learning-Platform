"use client";

import {
  getDepartmentsGetQueryOptions,
  getDepartmentsListQueryKey,
  getFacultiesListQueryKey,
  getUniversitiesListQueryKey,
  isApiError,
  useDepartmentsArchive,
  useDepartmentsList,
  useDepartmentsRemove,
  useDepartmentsRestore,
  useFacultiesList,
  useUniversitiesList,
} from "@heat/api-client";
import type { DepartmentListResponseDtoItemsItem } from "@heat/api-client";
import { departmentSortFields } from "@heat/contracts";
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
import { deleteBlockedMessage } from "./directory-copy";
import {
  archiveFailedMessage,
  directoryStatusItems,
  restoreFailedMessage,
  statusFilterKey,
  statusFilterOptions,
  statusFromUrl,
} from "./directory-status";
import { DepartmentFormSheet } from "./department-form-sheet";
import type { DepartmentFormTarget } from "./department-form-sheet";

type DepartmentRow = DepartmentListResponseDtoItemsItem;

const sortable = ["name", "createdAt"] as const;
const sortValues: readonly string[] = departmentSortFields;
const filterKeys = ["university", "faculty", statusFilterKey] as const;
const optionLimit = 50;
const all = "all";

export function DepartmentsView() {
  const queryClient = useQueryClient();
  const url = useTableUrlState({
    sortable,
    filters: filterKeys,
    filterOptions: statusFilterOptions,
  });
  const [target, setTarget] = useState<DepartmentFormTarget>(null);
  const [notice, setNotice] = useState<{ text: string; problem: boolean } | null>(null);
  const [blocked, setBlocked] = useState<{ id: string; message: string } | null>(null);
  const { university, faculty } = url.filters;
  const sortValue = url.sort ? `${url.sort.desc ? "-" : ""}${url.sort.id}` : undefined;
  const status = statusFromUrl(url.filters[statusFilterKey]);
  const params = {
    status,
    page: url.page,
    pageSize: url.pageSize,
    ...(sortValue !== undefined && sortValues.includes(sortValue)
      ? { sort: sortValue as (typeof departmentSortFields)[number] }
      : {}),
    ...(url.query ? { q: url.query } : {}),
    ...(university ? { universityId: university } : {}),
    ...(university && faculty ? { facultyId: faculty } : {}),
  };
  const list = useDepartmentsList(params);
  const remove = useDepartmentsRemove();
  const archive = useDepartmentsArchive();
  const restore = useDepartmentsRestore();
  const universities = useUniversitiesList({
    page: 1,
    pageSize: optionLimit,
    sort: "name",
    status: "all",
  });
  const faculties = useFacultiesList(
    { page: 1, pageSize: optionLimit, sort: "name", status: "all", universityId: university },
    { query: { enabled: Boolean(university) } },
  );
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);

  const universityItems = [
    { value: all, label: "All universities" },
    ...(universities.data?.items ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];
  const facultyItems = [
    { value: all, label: "All faculties" },
    ...(faculties.data?.items ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getDepartmentsListQueryKey().slice(0, 1) }),
      queryClient.invalidateQueries({ queryKey: getFacultiesListQueryKey().slice(0, 1) }),
      queryClient.invalidateQueries({ queryKey: getUniversitiesListQueryKey().slice(0, 1) }),
    ]);

  const columns = useMemo<DataTableColumn<DepartmentRow>[]>(
    () => [
      { id: "name", header: "Name", cell: (row) => row.name, sortable: true },
      { id: "university", header: "University", cell: (row) => row.university.name },
      { id: "faculty", header: "Faculty", cell: (row) => row.faculty.name },
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

  function actions(row: DepartmentRow) {
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
            title="Archive this department?"
            itemName={row.name}
            description="It stops being offered to new students. Existing students keep it. You can restore it later."
            confirmLabel="Archive department"
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
          title="Delete this department?"
          itemName={row.name}
          confirmationName={row.name}
          description="This removes it from the directory for good. Departments that students use cannot be deleted."
          confirmLabel="Delete department"
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
                  .fetchQuery({ ...getDepartmentsGetQueryOptions(row.id), staleTime: 0 })
                  .catch(() => row);
                setBlocked({
                  id: row.id,
                  message: deleteBlockedMessage(row.name, {
                    studentCount: current.studentCount,
                    departmentCount: 0,
                    facultyCount: 0,
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
        title="Departments"
        action={
          <Button
            onClick={() => {
              setNotice(null);
              setTarget("create");
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Add department
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
            aria-label="Search departments"
            placeholder="Search by name"
            defaultValue={url.query}
            onChange={(event) => url.setQuery(event.target.value.trim())}
          />
        }
      >
        <Field>
          <FieldLabel id="department-filter-university">University</FieldLabel>
          <Select
            items={universityItems}
            value={university || all}
            onValueChange={(value) => {
              url.setFilters({ university: value === all ? null : value, faculty: null });
            }}
          >
            <SelectTrigger aria-labelledby="department-filter-university" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {universityItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel id="department-filter-faculty">Faculty</FieldLabel>
          <Select
            items={facultyItems}
            value={faculty || all}
            disabled={!university}
            onValueChange={(value) => url.setFilter("faculty", value === all ? null : value)}
          >
            <SelectTrigger aria-labelledby="department-filter-faculty" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {facultyItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel id="department-filter-status">Status</FieldLabel>
          <Select
            items={directoryStatusItems}
            value={status}
            onValueChange={(value) =>
              url.setFilter(statusFilterKey, value === "active" ? null : value)
            }
          >
            <SelectTrigger aria-labelledby="department-filter-status" className="w-full">
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
        label="Departments"
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
        emptyTitle="No departments yet"
        emptyDescription="Add a department under a university and one of its faculties."
        actions={actions}
      />
      <DepartmentFormSheet
        target={target}
        onClose={() => setTarget(null)}
        onSaved={async (text) => {
          await refresh();
          setNotice({ text, problem: false });
        }}
      />
    </ShellContent>
  );
}
