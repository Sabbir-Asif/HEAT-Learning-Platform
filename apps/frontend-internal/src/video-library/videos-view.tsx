"use client";

import { useCoursesList, useVideoLibraryList } from "@heat/api-client";
import type { VideoLibraryListResponseDtoItemsItem } from "@heat/api-client";
import { videoLibraryStatusSchema, videoPollIntervalMs, videoStatusIsFinal } from "@heat/contracts";
import { FieldDescription, PageHeader, StatusBadge } from "@heat/ui";
import {
  DataTable,
  FilterBar,
  FilterSelect,
  useClampedPage,
  useTableUrlState,
} from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { filterIcon } from "../filters/filter-icon";
import { ShellContent } from "@heat/ui/shell";
import { useMemo } from "react";
import {
  videoFailureMessage,
  videoRejectionMessage,
  videoTimeLabel,
} from "../modules/modules-copy";
import {
  videoLibraryBadgeStatus,
  videoLibraryParams,
  videoLibrarySortable,
  videoLibraryStatusFilterKey,
  videoLibraryStatusFilterOptions,
  videoLibraryStatusLabels,
} from "./video-library-copy";

type VideoRow = VideoLibraryListResponseDtoItemsItem;

const filterKeys = ["course", videoLibraryStatusFilterKey] as const;
const optionLimit = 50;
const all = "all";

const reasonOf = (row: VideoRow): string | null => {
  if (row.status === "FAILED") return videoFailureMessage(row.failureReason);
  if (row.status === "REJECTED" && row.rejectionReason !== null) {
    return videoRejectionMessage(row.rejectionReason);
  }
  return null;
};

export function VideosView() {
  const url = useTableUrlState({
    sortable: videoLibrarySortable,
    filters: filterKeys,
    filterOptions: videoLibraryStatusFilterOptions,
  });
  const course = url.filters.course ?? "";
  const status = url.filters[videoLibraryStatusFilterKey] ?? "";
  const params = videoLibraryParams({
    page: url.page,
    pageSize: url.pageSize,
    sort: url.sort,
    status,
    course,
  });
  const list = useVideoLibraryList(params, {
    query: {
      refetchInterval: (query) =>
        query.state.data?.items.some((item) => !videoStatusIsFinal(item.status))
          ? videoPollIntervalMs
          : false,
    },
  });
  const courses = useCoursesList({ page: 1, pageSize: optionLimit, status: "all" });
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);
  const items = list.data?.items;
  const rows = useMemo(() => items ?? [], [items]);

  const courseItems = [
    { value: all, label: "All courses" },
    ...(courses.data?.items ?? []).map((entry) => ({ value: entry.id, label: entry.title })),
  ];
  const statusItems = [
    { value: all, label: "All statuses" },
    ...videoLibraryStatusSchema.options.map((value) => ({
      value,
      label: videoLibraryStatusLabels[value],
    })),
  ];

  const columns = useMemo<DataTableColumn<VideoRow>[]>(
    () => [
      {
        id: "title",
        header: "Video",
        sortable: true,
        cell: (row) => (
          <div className="flex flex-col">
            <strong>{row.title}</strong>
            <FieldDescription>{`${row.course.title}, ${row.module.title}`}</FieldDescription>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => {
          const reason = reasonOf(row);
          return (
            <div className="flex flex-col gap-1">
              <StatusBadge kind="video" status={videoLibraryBadgeStatus(row.status)} />
              {reason === null ? null : <FieldDescription>{reason}</FieldDescription>}
            </div>
          );
        },
      },
      { id: "uploadedAt", header: "Uploaded", cell: (row) => videoTimeLabel(row.uploadedAt) },
      {
        id: "statusChangedAt",
        header: "Status changed",
        sortable: true,
        cell: (row) => videoTimeLabel(row.statusChangedAt),
      },
    ],
    [],
  );

  const selectFilter = (
    id: string,
    label: string,
    entries: Array<{ value: string; label: string }>,
    value: string,
    onChange: (next: string | null) => void,
    truncated = false,
  ) => (
    <FilterSelect
      label={label}
      icon={filterIcon(label)}
      items={entries}
      value={value || all}
      defaultValue={all}
      note={
        truncated ? `Showing the first ${optionLimit}. Narrow with the other filters.` : undefined
      }
      onValueChange={(next) => onChange(next === all ? null : next)}
    />
  );

  return (
    <ShellContent>
      <PageHeader title="Videos" />
      <FilterBar activeCount={url.activeFilterCount} onClear={url.clearFilters}>
        {selectFilter(
          "course",
          "Course",
          courseItems,
          course,
          (next) => url.setFilter("course", next),
          (courses.data?.total ?? 0) > optionLimit,
        )}
        {selectFilter(videoLibraryStatusFilterKey, "Status", statusItems, status, (next) =>
          url.setFilter(videoLibraryStatusFilterKey, next),
        )}
      </FilterBar>
      <DataTable
        label="Videos"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        total={total}
        page={page}
        pageSize={url.pageSize}
        sort={url.sort ?? { id: "statusChangedAt", desc: true }}
        onToggleSort={url.toggleSort}
        onSortChange={url.setSort}
        onPageChange={url.setPage}
        onPageSizeChange={url.setPageSize}
        status={list.isError ? "error" : list.isPending ? "loading" : "ready"}
        fetching={list.isFetching && !list.isPending}
        onRetry={() => void list.refetch()}
        filtersActive={url.activeFilterCount > 0}
        onClearFilters={url.clearFilters}
        emptyTitle="No videos found"
        emptyDescription="Videos appear here after they are uploaded into a module."
      />
    </ShellContent>
  );
}
