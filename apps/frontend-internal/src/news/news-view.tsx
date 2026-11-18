"use client";

import { getNewsListQueryKey, useNewsList, useNewsRemove } from "@heat/api-client";
import type { NewsAdminListResponseDtoItemsItem } from "@heat/api-client";
import { newsSortFields } from "@heat/contracts";
import {
  Button,
  ConfirmDialog,
  Field,
  FieldDescription,
  FieldLabel,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from "@heat/ui";
import { DataTable, FilterBar, SearchInput, useClampedPage, useTableUrlState } from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { newsDeleteFailedMessage } from "./news-copy";
import {
  newsStatusFilterKey,
  newsStatusFilterOptions,
  newsStatusFromUrl,
  newsStatusItems,
} from "./news-status";

type NewsRow = NewsAdminListResponseDtoItemsItem;

const sortable = ["title", "publishedAt", "updatedAt"] as const;
const sortValues: readonly string[] = newsSortFields;

export function NewsView() {
  const queryClient = useQueryClient();
  const url = useTableUrlState({
    sortable,
    filters: [newsStatusFilterKey],
    filterOptions: newsStatusFilterOptions,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const sortValue = url.sort ? `${url.sort.desc ? "-" : ""}${url.sort.id}` : undefined;
  const status = newsStatusFromUrl(url.filters[newsStatusFilterKey]);
  const list = useNewsList({
    status,
    page: url.page,
    pageSize: url.pageSize,
    ...(sortValue !== undefined && sortValues.includes(sortValue)
      ? { sort: sortValue as (typeof newsSortFields)[number] }
      : {}),
    ...(url.query ? { q: url.query } : {}),
  });
  const remove = useNewsRemove();
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getNewsListQueryKey().slice(0, 1) });

  const columns = useMemo<DataTableColumn<NewsRow>[]>(
    () => [
      { id: "title", header: "Title", cell: (row) => row.title, sortable: true },
      { id: "slug", header: "Slug", cell: (row) => row.slug },
      {
        id: "status",
        header: "Status",
        cell: (row) => <StatusBadge kind="news" status={row.status} />,
      },
      {
        id: "publishedAt",
        header: "Publish date",
        cell: (row) => (row.publishedAt === null ? "Not set" : formatDhakaTime(row.publishedAt)),
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

  function actions(row: NewsRow) {
    return (
      <>
        <Button variant="outline" size="sm" render={<Link href={`/content/news/${row.id}`} />}>
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
          title="Delete this post?"
          itemName={row.title}
          confirmationName={row.title}
          description="The post is removed from the public site. Its address stays reserved."
          confirmLabel="Delete post"
          destructive
          errorMessage={newsDeleteFailedMessage(row.title)}
          onConfirm={async () => {
            setNotice(null);
            await remove.mutateAsync({ id: row.id });
            await refresh();
            setNotice(`${row.title} was deleted.`);
          }}
        />
      </>
    );
  }

  return (
    <ShellContent>
      <PageHeader
        title="News"
        action={
          <Button render={<Link href="/content/news/new" />}>
            <PlusIcon data-icon="inline-start" />
            New post
          </Button>
        }
      />
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <FilterBar
        activeCount={url.activeFilterCount}
        onClear={url.clearFilters}
        search={
          <SearchInput
            label="Search posts"
            placeholder="Search by title or slug"
            value={url.query}
            onValueChange={url.setQuery}
          />
        }
      >
        <Field>
          <FieldLabel id="news-filter-status">Status</FieldLabel>
          <Select
            items={newsStatusItems}
            value={status}
            onValueChange={(value) =>
              url.setFilter(newsStatusFilterKey, value === "all" ? null : value)
            }
          >
            <SelectTrigger aria-labelledby="news-filter-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {newsStatusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FilterBar>
      <DataTable
        label="News posts"
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
        emptyTitle="No news posts yet"
        emptyDescription="Write a post to share an update with students."
        actions={actions}
      />
    </ShellContent>
  );
}
