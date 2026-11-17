import { Inject, Injectable } from "@nestjs/common";
import type { StudentFilter, StudentListQuery, StudentListResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { profileFilter } from "./approval-queue.service";

const searchFilter = (q: string | undefined) =>
  q === undefined
    ? {}
    : {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { profile: { is: { name: { contains: q, mode: "insensitive" as const } } } },
        ],
      };

export const studentWhere = (query: StudentFilter) => ({
  deletedAt: null,
  ...(query.courseId === undefined ? {} : { courseId: query.courseId }),
  ...(query.status === undefined ? {} : { status: query.status }),
  user: { deletedAt: null, ...profileFilter(query), ...searchFilter(query.q) },
});

const orderBy = (sort: StudentListQuery["sort"]) => {
  switch (sort) {
    case "name":
      return [{ user: { profile: { name: "asc" as const } } }, { id: "asc" as const }];
    case "-name":
      return [{ user: { profile: { name: "desc" as const } } }, { id: "asc" as const }];
    case "requestedAt":
      return [{ requestedAt: "asc" as const }, { id: "asc" as const }];
    case "-requestedAt":
      return [{ requestedAt: "desc" as const }, { id: "asc" as const }];
  }
};

const rowSelect = {
  id: true,
  status: true,
  requestedAt: true,
  userId: true,
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
export class StudentListService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async list(query: StudentListQuery): Promise<StudentListResponse> {
    const where = studentWhere(query);
    const [rows, total] = await Promise.all([
      this.database.enrollment.findMany({
        where,
        orderBy: orderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: rowSelect,
      }),
      this.database.enrollment.count({ where }),
    ]);
    const items: StudentListResponse["items"] = [];
    for (const row of rows) {
      const profile = row.user.profile;
      if (profile === null) continue;
      const { university, faculty } = profile.department.universityFaculty;
      items.push({
        id: row.id,
        status: row.status,
        requestedAt: row.requestedAt.toISOString(),
        student: { userId: row.userId, name: profile.name, email: row.user.email },
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
