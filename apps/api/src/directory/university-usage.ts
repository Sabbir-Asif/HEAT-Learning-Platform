import { assertNotInUse, RecordInUseError } from "@heat/db";
import type { HeatClient } from "@heat/db";

export interface UniversityUsage {
  students: number;
  departments: number;
  faculties: number;
}

export const usageOf = async (database: HeatClient, id: string): Promise<UniversityUsage> => {
  const [students, departments, faculties] = await Promise.all([
    database
      .$includingDeleted()
      .studentProfile.count({ where: { department: { universityId: id } } }),
    database.department.count({ where: { universityId: id } }),
    database.universityFaculty.count({ where: { universityId: id } }),
  ]);
  return { students, departments, faculties };
};

const plural = (count: number, singular: string, many: string): string =>
  `${count} ${count === 1 ? singular : many}`;

const joinPhrases = (phrases: readonly string[]): string =>
  phrases.length <= 1
    ? (phrases[0] ?? "")
    : `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;

export const blockingMessage = (usage: UniversityUsage): string | null => {
  try {
    assertNotInUse([
      { name: plural(usage.students, "student", "students"), count: usage.students },
      { name: plural(usage.departments, "department", "departments"), count: usage.departments },
      { name: plural(usage.faculties, "faculty link", "faculty links"), count: usage.faculties },
    ]);
    return null;
  } catch (error) {
    if (error instanceof RecordInUseError) {
      return `This university is used by ${joinPhrases(error.blockers.map((blocker) => blocker.name))}, so it cannot be deleted.`;
    }
    throw error;
  }
};

export const departmentUsageOf = async (
  database: HeatClient,
  ids: readonly string[],
): Promise<Map<string, { departments: number; students: number }>> => {
  const usage = new Map<string, { departments: number; students: number }>();
  if (ids.length === 0) return usage;
  const departments = await database.$includingDeleted().department.findMany({
    where: { universityId: { in: [...ids] } },
    select: { universityId: true, _count: { select: { profiles: true } } },
  });
  for (const department of departments) {
    const current = usage.get(department.universityId) ?? { departments: 0, students: 0 };
    usage.set(department.universityId, {
      departments: current.departments + 1,
      students: current.students + department._count.profiles,
    });
  }
  return usage;
};
