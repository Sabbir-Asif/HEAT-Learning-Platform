import type { HeatClient } from "@heat/db";
import { deleteBlockedMessage, plural } from "./directory-rules";

export interface FacultyUsage {
  students: number;
  departments: number;
  universities: number;
}

export const usageOf = async (database: HeatClient, id: string): Promise<FacultyUsage> => {
  const [students, departments, universities] = await Promise.all([
    database.$includingDeleted().studentProfile.count({ where: { department: { facultyId: id } } }),
    database.department.count({ where: { facultyId: id } }),
    database.universityFaculty.count({ where: { facultyId: id } }),
  ]);
  return { students, departments, universities };
};

export const blockingMessage = (usage: FacultyUsage): string | null =>
  deleteBlockedMessage("faculty", [
    { name: plural(usage.students, "student", "students"), count: usage.students },
    { name: plural(usage.departments, "department", "departments"), count: usage.departments },
    {
      name: plural(usage.universities, "university link", "university links"),
      count: usage.universities,
    },
  ]);

export const departmentUsageOf = async (
  database: HeatClient,
  ids: readonly string[],
): Promise<Map<string, { departments: number; students: number }>> => {
  const usage = new Map<string, { departments: number; students: number }>();
  if (ids.length === 0) return usage;
  const departments = await database.$includingDeleted().department.findMany({
    where: { facultyId: { in: [...ids] } },
    select: { facultyId: true, _count: { select: { profiles: true } } },
  });
  for (const department of departments) {
    const current = usage.get(department.facultyId) ?? { departments: 0, students: 0 };
    usage.set(department.facultyId, {
      departments: current.departments + 1,
      students: current.students + department._count.profiles,
    });
  }
  return usage;
};

const listedDepartments = 5;

export const unassignBlockedMessage = (
  facultyName: string,
  universityName: string,
  departmentNames: readonly string[],
): string => {
  const shown = departmentNames.slice(0, listedDepartments).join(", ");
  const rest = departmentNames.length - listedDepartments;
  const names = rest > 0 ? `${shown} and ${rest} more` : shown;
  return `${facultyName} has ${plural(departmentNames.length, "department", "departments")} at ${universityName} (${names}), so it cannot be removed from that university.`;
};
