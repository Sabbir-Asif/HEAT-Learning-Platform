"use client";

import { getTagsListQueryKey, useTagsList } from "@heat/api-client";
import type { TagListResponseDtoItemsItem } from "@heat/api-client";
import { Badge, Button, FieldDescription, PageHeader } from "@heat/ui";
import { DataTable, useClampedPage, useTableUrlState } from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { TagDeleteDialog } from "./tag-delete-dialog";
import { TagFormSheet } from "./tag-form-sheet";
import type { TagFormTarget } from "./tag-form-sheet";

type TagRow = TagListResponseDtoItemsItem;

const sortable = ["name"] as const;

export function TagsView() {
  const queryClient = useQueryClient();
  const url = useTableUrlState({ sortable });
  const [target, setTarget] = useState<TagFormTarget>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = useTagsList();
  const items = useMemo(() => {
    const rows = [...(list.data?.items ?? [])].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    return url.sort?.desc ? rows.reverse() : rows;
  }, [list.data, url.sort]);
  const total = items.length;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);
  const visible = items.slice((page - 1) * url.pageSize, page * url.pageSize);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getTagsListQueryKey() });

  const columns = useMemo<DataTableColumn<TagRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (row) => (
          <span className="flex items-center gap-2">
            {row.name}
            {row.isSystem ? <Badge variant="secondary">Built in</Badge> : null}
          </span>
        ),
        sortable: true,
      },
      { id: "courses", header: "Courses", cell: (row) => String(row.courseCount) },
      { id: "modules", header: "Modules", cell: (row) => String(row.moduleCount) },
      { id: "updatedAt", header: "Updated", cell: (row) => formatDhakaTime(row.updatedAt) },
    ],
    [],
  );

  function actions(row: TagRow) {
    if (row.isSystem) return null;
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
        <TagDeleteDialog
          tag={row}
          onDeleted={async (message) => {
            await refresh();
            setNotice(message);
          }}
        />
      </>
    );
  }

  return (
    <ShellContent>
      <PageHeader
        title="Tags"
        action={
          <Button
            onClick={() => {
              setNotice(null);
              setTarget("create");
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Add tag
          </Button>
        }
      />
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <DataTable
        label="Tags"
        columns={columns}
        rows={visible}
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
        emptyTitle="No tags yet"
        emptyDescription="Add a tag to group courses and modules."
        actions={actions}
      />
      <TagFormSheet
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
