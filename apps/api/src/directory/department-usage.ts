import type { HeatClient } from "@heat/db";
import { deleteBlockedMessage, plural } from "./directory-rules";

export const studentCountOf = (database: HeatClient, id: string): Promise<number> =>
  database.$includingDeleted().studentProfile.count({ where: { departmentId: id } });

export const studentCountsOf = async (
  database: HeatClient,
  ids: readonly string[],
): Promise<Map<string, number>> => {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const departments = await database.$includingDeleted().department.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, _count: { select: { profiles: true } } },
  });
  for (const department of departments) counts.set(department.id, department._count.profiles);
  return counts;
};

export const deleteBlockingMessage = (students: number): string | null =>
  deleteBlockedMessage("department", [
    { name: plural(students, "student", "students"), count: students },
  ]);

export const moveBlockedMessage = (departmentName: string, students: number): string =>
  `${departmentName} has ${plural(students, "student", "students")}, so it cannot be moved to another university or faculty.`;
