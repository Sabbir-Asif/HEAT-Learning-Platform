import type { LearningContent, LearningStructureResponse } from "@heat/contracts";

export type LearningModule = LearningContent["modules"][number];

export const uuid = (n: number) => `0198f1a0-0000-7000-8000-${String(n).padStart(12, "0")}`;

export const makeModule = (n: number, overrides: Partial<LearningModule> = {}): LearningModule => ({
  id: uuid(n),
  order: n,
  title: `Module ${n}`,
  objectives: [`Objective ${n}`],
  state: "UNLOCKED",
  requiredVideosCompleted: 0,
  requiredVideosTotal: 2,
  lessonSections: [],
  videos: [
    {
      id: uuid(200 + n),
      order: 1,
      title: `Video ${n}`,
      required: true,
      durationSeconds: 120,
      status: "NOT_STARTED",
      coveragePercent: 0,
      resumePositionSeconds: 0,
    },
  ],
  quiz: {
    id: uuid(100 + n),
    availability: "UNAVAILABLE",
    questionCount: 5,
    passMarkPercent: 70,
    attemptsUsed: 0,
    attemptsAllowed: 3,
    nextAttemptAt: null,
  },
  ...overrides,
});

export const makeStructure = (
  modules: LearningModule[],
  overrides: Partial<LearningStructureResponse> = {},
): LearningStructureResponse => ({
  course: { id: uuid(1), slug: "heat", title: "HEAT Gender Safety" },
  enrollment: { status: "APPROVED", reason: null },
  learning: {
    revision: { id: uuid(2), number: 1 },
    summary: {
      overallProgressPercent: 25,
      modulesCompleted: 1,
      modulesTotal: modules.length,
      nextModuleId: modules[0]?.id ?? null,
    },
    modules,
  },
  ...overrides,
});
