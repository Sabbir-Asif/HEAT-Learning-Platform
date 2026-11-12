import { Inject, Injectable } from "@nestjs/common";
import type { ApprovalQueueQuery, ApprovalQueueResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";

const dhakaOffset = "+06:00";
const dayMilliseconds = 24 * 60 * 60 * 1000;

const startOfDay = (date: string): Date => new Date(`${date}T00:00:00${dhakaOffset}`);

const submittedRange = (query: ApprovalQueueQuery) => {
  if (query.submittedFrom === undefined && query.submittedTo === undefined) return {};
  return {
    requestedAt: {
      ...(query.submittedFrom === undefined ? {} : { gte: startOfDay(query.submittedFrom) }),
      ...(query.submittedTo === undefined
        ? {}
        : { lt: new Date(startOfDay(query.submittedTo).getTime() + dayMilliseconds) }),
    },
  };
};

const profileFilter = (query: ApprovalQueueQuery) => {
  const department = {
    ...(query.universityId === undefined ? {} : { universityId: query.universityId }),
    ...(query.facultyId === undefined ? {} : { facultyId: query.facultyId }),
  };
  const is = {
    ...(query.departmentId === undefined ? {} : { departmentId: query.departmentId }),
    ...(query.session === undefined ? {} : { session: query.session }),
    ...(Object.keys(department).length === 0 ? {} : { department }),
  };
  return Object.keys(is).length === 0 ? {} : { profile: { is } };
};

export const queueWhere = (query: ApprovalQueueQuery) => ({
  status: "PENDING_APPROVAL" as const,
  deletedAt: null,
  ...(query.courseId === undefined ? {} : { courseId: query.courseId }),
  ...submittedRange(query),
  user: { deletedAt: null, ...profileFilter(query) },
});

const rowSelect = {
  id: true,
  requestedAt: true,
  verifiedAt: true,
  course: { select: { id: true, title: true } },
  user: {
    select: {
      email: true,
      profile: {
        select: {
          name: true,
          session: true,
          department: {
            select: {
              id: true,
              name: true,
              universityFaculty: {
                select: {
                  university: { select: { id: true, name: true } },
                  faculty: { select: { id: true, name: true } },
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
export class ApprovalQueueService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async list(query: ApprovalQueueQuery): Promise<ApprovalQueueResponse> {
    const where = queueWhere(query);
    const [rows, total] = await Promise.all([
      this.database.enrollment.findMany({
        where,
        orderBy: [{ requestedAt: query.sort === "requestedAt" ? "asc" : "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: rowSelect,
      }),
      this.database.enrollment.count({ where }),
    ]);
    const items: ApprovalQueueResponse["items"] = [];
    for (const row of rows) {
      const profile = row.user.profile;
      if (profile === null) continue;
      const { university, faculty } = profile.department.universityFaculty;
      items.push({
        id: row.id,
        requestedAt: row.requestedAt.toISOString(),
        verifiedAt: row.verifiedAt?.toISOString() ?? null,
        student: { name: profile.name, email: row.user.email },
        course: row.course,
        university,
        faculty,
        department: { id: profile.department.id, name: profile.department.name },
        session: profile.session,
      });
    }
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
