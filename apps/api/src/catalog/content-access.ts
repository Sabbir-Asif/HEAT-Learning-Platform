import type { HeatClient } from "@heat/db";
import { ApiException } from "../http/api-exception";
import type { OrderPlan, OrderStep } from "./module-rules";

export interface ContentScope {
  revisionId: string;
  lockedAt: Date | null;
}

export type ContentReader = Pick<HeatClient, "course">;

export type ContentLocker = Pick<HeatClient, "course" | "$queryRaw">;

export const readScope = async (client: ContentReader, courseId: string): Promise<ContentScope> => {
  const course = await client.course.findUnique({
    where: { id: courseId },
    select: {
      lockedAt: true,
      revisions: { select: { id: true }, orderBy: { number: "desc" }, take: 1 },
    },
  });
  const revision = course?.revisions[0];
  if (course === null || revision === undefined) throw new ApiException(404, "NOT_FOUND");
  return { revisionId: revision.id, lockedAt: course.lockedAt };
};

export const lockScope = async (client: ContentLocker, courseId: string): Promise<ContentScope> => {
  const locked = await client.$queryRaw<Array<{ lockedAt: Date | null }>>`
    SELECT "lockedAt" FROM "Course" WHERE id = ${courseId}::uuid FOR UPDATE`;
  const row = locked[0];
  if (row === undefined) throw new ApiException(404, "NOT_FOUND");
  const scope = await readScope(client, courseId);
  return { revisionId: scope.revisionId, lockedAt: row.lockedAt };
};

export const applyOrderPlan = async (
  plan: OrderPlan,
  update: (step: OrderStep) => Promise<unknown>,
): Promise<void> => {
  for (const step of plan.parking) await update(step);
  for (const step of plan.final) await update(step);
};
