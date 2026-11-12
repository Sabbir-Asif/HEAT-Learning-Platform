import { Injectable } from "@nestjs/common";
import type { PublishFailure } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { ApiException } from "../http/api-exception";
import type { CoursePublishCheck } from "./publish-checks";
import { evaluatePublishChecks } from "./publish-rules";
import type { PublishModule } from "./publish-rules";

export type PublishCheckClient = Pick<HeatClient, "course" | "module" | "$queryRaw">;

const moduleSelect = {
  id: true,
  order: true,
  title: true,
  videos: {
    where: { deletedAt: null },
    select: { required: true, asset: { select: { id: true, status: true } } },
  },
  quiz: {
    select: {
      deletedAt: true,
      questions: {
        where: { deletedAt: null },
        orderBy: { order: "asc" as const },
        select: { id: true, order: true, options: { select: { isCorrect: true } } },
      },
    },
  },
} as const;

type ModuleRow = Awaited<ReturnType<typeof readModules>>[number];

const readModules = async (client: PublishCheckClient, courseId: string) => {
  const course = await client.course.findUnique({
    where: { id: courseId },
    select: { revisions: { select: { id: true }, orderBy: { number: "desc" }, take: 1 } },
  });
  const revision = course?.revisions[0];
  if (course === null || revision === undefined) throw new ApiException(404, "NOT_FOUND");
  return client.module.findMany({
    where: { revisionId: revision.id, deletedAt: null },
    orderBy: { order: "asc" },
    select: moduleSelect,
  });
};

const toPublishModule = (row: ModuleRow): PublishModule => ({
  id: row.id,
  order: row.order,
  title: row.title,
  videos: row.videos.map((video) => ({
    required: video.required,
    status: video.asset?.status ?? null,
  })),
  quiz: row.quiz === null || row.quiz.deletedAt !== null ? null : { questions: row.quiz.questions },
});

const assetIdsOf = (rows: ModuleRow[]): string[] =>
  rows.flatMap((row) =>
    row.videos.flatMap((video) => (video.asset === null ? [] : [video.asset.id])),
  );

@Injectable()
export class ModulePublishCheck implements CoursePublishCheck {
  async evaluate(
    courseId: string,
    client: PublishCheckClient,
    lockAssets: boolean,
  ): Promise<PublishFailure[]> {
    let rows = await readModules(client, courseId);
    if (lockAssets) {
      const assetIds = assetIdsOf(rows);
      if (assetIds.length > 0) {
        await client.$queryRaw`
          SELECT id FROM "VideoAsset" WHERE id = ANY(${assetIds}::uuid[]) FOR SHARE`;
        rows = await readModules(client, courseId);
      }
    }
    return evaluatePublishChecks(rows.map(toPublishModule));
  }

  async failures(courseId: string, client: PublishCheckClient): Promise<string[]> {
    const failures = await this.evaluate(courseId, client, true);
    return failures.map((failure) => failure.message);
  }
}
