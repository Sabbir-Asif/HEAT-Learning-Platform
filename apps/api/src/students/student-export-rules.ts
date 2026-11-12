import type { StudentFilter } from "@heat/contracts";

const dhakaOffsetMilliseconds = 6 * 60 * 60 * 1000;

export const studentExportColumns = [
  "Name",
  "Email",
  "University",
  "Faculty",
  "Department",
  "Session",
  "Course",
  "Status",
  "Requested (Asia/Dhaka)",
  "Approved (Asia/Dhaka)",
  "Completed (Asia/Dhaka)",
  "Progress",
] as const;

export const studentListWhere = (filter: StudentFilter) => {
  const department = {
    ...(filter.universityId === undefined ? {} : { universityId: filter.universityId }),
    ...(filter.facultyId === undefined ? {} : { facultyId: filter.facultyId }),
  };
  const search = filter.search;
  return {
    deletedAt: null,
    ...(filter.courseId === undefined ? {} : { courseId: filter.courseId }),
    ...(filter.status === undefined ? {} : { status: filter.status }),
    user: {
      deletedAt: null,
      profile: {
        is: {
          deletedAt: null,
          ...(filter.departmentId === undefined ? {} : { departmentId: filter.departmentId }),
          ...(filter.session === undefined ? {} : { session: filter.session }),
          ...(Object.keys(department).length === 0 ? {} : { department }),
        },
      },
    },
    ...(search === undefined
      ? {}
      : {
          OR: [
            { user: { email: { contains: search, mode: "insensitive" as const } } },
            {
              user: {
                profile: { is: { name: { contains: search, mode: "insensitive" as const } } },
              },
            },
          ],
        }),
  };
};

export const formatDhakaDateTime = (date: Date | null): string =>
  date === null
    ? ""
    : new Date(date.getTime() + dhakaOffsetMilliseconds)
        .toISOString()
        .slice(0, 16)
        .replace("T", " ");

export const progressSummary = (completed: number, total: number): string =>
  `${completed} of ${total} modules`;
