import { videoLibraryStatusSchema } from "@heat/contracts";
import type { VideoLibraryStatus } from "@heat/contracts";
import type { VideoLibraryListParams } from "@heat/api-client";
import type { SortState } from "@heat/ui/data";

export const videoLibraryStatusFilterKey = "status";
export const videoLibraryStatusFilterOptions = {
  [videoLibraryStatusFilterKey]: videoLibraryStatusSchema.options,
};

export const videoLibraryStatusLabels: Record<VideoLibraryStatus, string> = {
  UPLOADING: "Uploading",
  UPLOADED: "Uploaded",
  QUEUED: "Queued",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
  REJECTED: "Rejected",
};

export const videoLibraryBadgeStatus = (status: VideoLibraryStatus): string => status.toLowerCase();

export const videoLibrarySortable = ["title", "statusChangedAt"] as const;

export type VideoLibrarySortValue = NonNullable<VideoLibraryListParams["sort"]>;

export const videoLibrarySortValue = (sort: SortState | null): VideoLibrarySortValue => {
  if (sort === null) return "-statusChangedAt";
  const id = sort.id === "title" ? "title" : "statusChangedAt";
  return sort.desc ? `-${id}` : id;
};

export const videoLibraryParams = (state: {
  page: number;
  pageSize: number;
  sort: SortState | null;
  status: string;
  course: string;
}): VideoLibraryListParams => {
  const status = videoLibraryStatusSchema.safeParse(state.status);
  return {
    page: state.page,
    pageSize: state.pageSize,
    sort: videoLibrarySortValue(state.sort),
    ...(status.success ? { status: status.data } : {}),
    ...(state.course ? { courseId: state.course } : {}),
  };
};
