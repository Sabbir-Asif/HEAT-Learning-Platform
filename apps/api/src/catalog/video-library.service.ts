import { Inject, Injectable } from "@nestjs/common";
import { videoFailureReasonSchema, videoRejectionReasonSchema } from "@heat/contracts";
import type {
  VideoFailureReason,
  VideoLibraryListQuery,
  VideoLibraryListResponse,
  VideoRejectionReason,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";

export const videoLibraryWhere = (query: VideoLibraryListQuery) => ({
  deletedAt: null,
  assetId: { not: null },
  ...(query.status === undefined ? {} : { asset: { is: { status: query.status } } }),
  module: {
    deletedAt: null,
    ...(query.courseId === undefined ? {} : { revision: { courseId: query.courseId } }),
  },
});

const orderBy = (sort: VideoLibraryListQuery["sort"]) => {
  switch (sort) {
    case "title":
      return [{ title: "asc" as const }, { id: "asc" as const }];
    case "-title":
      return [{ title: "desc" as const }, { id: "asc" as const }];
    case "statusChangedAt":
      return [{ asset: { updatedAt: "asc" as const } }, { id: "asc" as const }];
    case "-statusChangedAt":
      return [{ asset: { updatedAt: "desc" as const } }, { id: "asc" as const }];
  }
};

const rowSelect = {
  id: true,
  title: true,
  asset: {
    select: {
      status: true,
      rejectionReason: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  module: {
    select: {
      id: true,
      title: true,
      revision: { select: { course: { select: { id: true, title: true } } } },
    },
  },
} as const;

const rejectionOf = (value: string | null): VideoRejectionReason | null => {
  const parsed = videoRejectionReasonSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const failureOf = (value: string | null): VideoFailureReason | null => {
  const parsed = videoFailureReasonSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

@Injectable()
export class VideoLibraryService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async list(query: VideoLibraryListQuery): Promise<VideoLibraryListResponse> {
    const where = videoLibraryWhere(query);
    const [rows, total] = await Promise.all([
      this.database.video.findMany({
        where,
        orderBy: orderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: rowSelect,
      }),
      this.database.video.count({ where }),
    ]);
    const items: VideoLibraryListResponse["items"] = [];
    for (const row of rows) {
      if (row.asset === null) continue;
      items.push({
        id: row.id,
        title: row.title,
        status: row.asset.status,
        rejectionReason: rejectionOf(row.asset.rejectionReason),
        failureReason: failureOf(row.asset.failureReason),
        uploadedAt: row.asset.createdAt.toISOString(),
        statusChangedAt: row.asset.updatedAt.toISOString(),
        course: row.module.revision.course,
        module: { id: row.module.id, title: row.module.title },
      });
    }
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
