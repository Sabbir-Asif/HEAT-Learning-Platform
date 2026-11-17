import { Inject, Injectable } from "@nestjs/common";
import type { StudentExportQuery } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import type { AuditActor } from "../audit";
import { DATABASE } from "../core";
import { studentWhere } from "./student-list.service";
import { csvByteOrderMark, csvLine } from "./csv";
import { formatDhakaDateTime, progressSummary, studentExportColumns } from "./student-export-rules";

export const exportBatchSize = 500;

const rowSelect = {
  id: true,
  status: true,
  requestedAt: true,
  approvedAt: true,
  completedAt: true,
  course: { select: { title: true } },
  courseRevision: { select: { _count: { select: { modules: { where: { deletedAt: null } } } } } },
  _count: { select: { moduleProgress: { where: { status: "COMPLETED" as const } } } },
  user: {
    select: {
      email: true,
      profile: {
        select: {
          name: true,
          session: true,
          department: {
            select: {
              name: true,
              universityFaculty: {
                select: {
                  university: { select: { name: true } },
                  faculty: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class StudentExportService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
  ) {}

  async *stream(
    query: StudentExportQuery,
    actor: AuditActor,
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    const where = studentWhere(query);
    let rowCount = 0;
    let completed = false;
    try {
      yield `${csvByteOrderMark}${csvLine(studentExportColumns)}`;
      let lastId: string | undefined;
      while (!signal.aborted) {
        const batch = await this.database.enrollment.findMany({
          where: lastId === undefined ? where : { AND: [where, { id: { gt: lastId } }] },
          orderBy: { id: "asc" },
          take: exportBatchSize,
          select: rowSelect,
        });
        if (batch.length === 0) {
          completed = true;
          break;
        }
        let chunk = "";
        for (const row of batch) {
          const profile = row.user.profile;
          if (profile === null) continue;
          const { university, faculty } = profile.department.universityFaculty;
          chunk += csvLine([
            profile.name,
            row.user.email,
            university.name,
            faculty.name,
            profile.department.name,
            profile.session,
            row.course.title,
            row.status,
            formatDhakaDateTime(row.requestedAt),
            formatDhakaDateTime(row.approvedAt),
            formatDhakaDateTime(row.completedAt),
            progressSummary(row._count.moduleProgress, row.courseRevision?._count.modules ?? 0),
          ]);
          rowCount += 1;
        }
        lastId = batch[batch.length - 1]?.id;
        if (chunk !== "") yield chunk;
        if (batch.length < exportBatchSize) {
          completed = true;
          break;
        }
      }
    } finally {
      await this.audit.recordStandalone(actor, {
        action: "students.export",
        entity: "StudentExport",
        after: { filters: query, rowCount, completed },
      });
    }
  }
}
