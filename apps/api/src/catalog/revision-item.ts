import type { CourseRevisionItem } from "@heat/contracts";
import { revisionLocked, revisionStatus } from "./revision-rules";

export interface RevisionRow {
  id: string;
  number: number;
  publishedAt: Date | null;
  createdAt: Date;
  _count: { enrollments: number };
}

export const toRevisionItem = (row: RevisionRow, latestId: string): CourseRevisionItem => {
  const latest = row.id === latestId;
  return {
    id: row.id,
    number: row.number,
    status: revisionStatus(row.publishedAt),
    locked: revisionLocked({
      publishedAt: row.publishedAt,
      enrollmentCount: row._count.enrollments,
      latest,
    }),
    current: latest,
    enrollmentCount: row._count.enrollments,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
};
