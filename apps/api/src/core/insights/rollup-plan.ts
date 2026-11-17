import { rollupMetrics } from "./rollup-model";
import type { RollupRow } from "./rollup-model";

export interface DayWritePlan {
  upserts: RollupRow[];
  deleteKeys: string[];
  unchanged: number;
}

const sameValues = (a: RollupRow, b: RollupRow): boolean =>
  rollupMetrics.every((metric) => a.metrics[metric] === b.metrics[metric]) &&
  a.courseId === b.courseId &&
  a.universityId === b.universityId &&
  a.facultyId === b.facultyId;

export const planDayWrite = (
  existing: readonly RollupRow[],
  next: readonly RollupRow[],
): DayWritePlan => {
  const current = new Map(existing.map((row) => [row.key, row] as const));
  const nextKeys = new Set(next.map((row) => row.key));
  const upserts: RollupRow[] = [];
  let unchanged = 0;
  for (const row of next) {
    const previous = current.get(row.key);
    if (previous !== undefined && sameValues(previous, row)) unchanged += 1;
    else upserts.push(row);
  }
  const deleteKeys = existing.map((row) => row.key).filter((key) => !nextKeys.has(key));
  return { upserts, deleteKeys, unchanged };
};
