"use client";

import { getResourcesListQueryKey, useResourcesList, useResourcesRemove } from "@heat/api-client";
import type { ResourceAdminDto } from "@heat/api-client";
import { formatFileSize, resourceTypeLabel } from "@heat/contracts";
import type { resourceSortFields } from "@heat/contracts";
import {
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
  StatusBadge,
} from "@heat/ui";
import { DataTable, FilterBar, useClampedPage, useTableUrlState } from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { resourceDeleteFailedMessage, resourceDeletedMessage } from "./resources-copy";
import {
  resourceStatusFilterKey,
  resourceStatusFilterOptions,
  resourceStatusFromUrl,
  resourceStatusItems,
} from "./resources-status";

type ResourceRow = ResourceAdminDto;

type SortValue = (typeof resourceSortFields)[number];

const sortable = ["title", "displayOrder", "updatedAt"] as const;
const sortValues: readonly string[] = [
  "title",
  "-title",
  "displayOrder",
  "-displayOrder",
  "updatedAt",
  "-updatedAt",
];

const detailOf = (row: ResourceRow): string => {
  const type = resourceTypeLabel(row.kind, row.file?.mimeType ?? null);
  return row.file === null ? type : `${type}, ${formatFileSize(row.file.sizeBytes)}`;
};

export function ResourcesView() {
  const queryClient = useQueryClient();
  const url = useTableUrlState({
    sortable,
    filters: [resourceStatusFilterKey],
    filterOptions: resourceStatusFilterOptions,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const sortValue = url.sort ? `${url.sort.desc ? "-" : ""}${url.sort.id}` : undefined;
  const status = resourceStatusFromUrl(url.filters[resourceStatusFilterKey]);
  const list = useResourcesList({
    status,
    page: url.page,
    pageSize: url.pageSize,
    ...(sortValue !== undefined && sortValues.includes(sortValue)
      ? { sort: sortValue as SortValue }
      : {}),
    ...(url.query ? { q: url.query } : {}),
  });
  const remove = useResourcesRemove();
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getResourcesListQueryKey().slice(0, 1) });

  const columns = useMemo<DataTableColumn<ResourceRow>[]>(
    () => [
      { id: "title", header: "Title", cell: (row) => row.title, sortable: true },
      { id: "type", header: "Type", cell: detailOf },
      { id: "course", header: "Course", cell: (row) => row.courseTitle ?? "None" },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <StatusBadge kind="resource" status={row.published ? "published" : "draft"} />
        ),
      },
      {
        id: "displayOrder",
        header: "Order",
        cell: (row) => String(row.displayOrder),
        sortable: true,
      },
      {
        id: "updatedAt",
        header: "Updated",
        cell: (row) => formatDhakaTime(row.updatedAt),
        sortable: true,
      },
    ],
    [],
  );

  function actions(row: ResourceRow) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/content/resources/${row.id}`} />}
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
          title="Delete this resource?"
          itemName={row.title}
          confirmationName={row.title}
          description="The resource is removed from the public page. An uploaded file is deleted within 24 hours."
          confirmLabel="Delete resource"
          destructive
          errorMessage={resourceDeleteFailedMessage(row.title)}
          onConfirm={async () => {
            setNotice(null);
            await remove.mutateAsync({ id: row.id });
            await refresh();
            setNotice(resourceDeletedMessage(row.title));
          }}
        />
      </>
    );
  }

  return (
    <ShellContent>
      <PageHeader
        title="Resources"
        action={
          <Button nativeButton={false} render={<Link href="/content/resources/new" />}>
            <PlusIcon data-icon="inline-start" />
            New resource
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
            aria-label="Search resources"
            placeholder="Search by title"
            defaultValue={url.query}
            onChange={(event) => url.setQuery(event.target.value.trim())}
          />
        }
      >
        <Field>
          <FieldLabel id="resource-filter-status">Status</FieldLabel>
          <Select
            items={resourceStatusItems}
            value={status}
            onValueChange={(value) =>
              url.setFilter(resourceStatusFilterKey, value === "all" ? null : value)
            }
          >
            <SelectTrigger aria-labelledby="resource-filter-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resourceStatusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FilterBar>
      <DataTable
        label="Resources"
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
        emptyTitle="No resources yet"
        emptyDescription="Add a file or a link for visitors to download or open."
        actions={actions}
      />
    </ShellContent>
  );
}
