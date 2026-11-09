import { Prisma } from "./generated/client";

export const softDeletedModels: ReadonlySet<string> = new Set([
  "Course",
  "CourseRevision",
  "Enrollment",
  "LessonSection",
  "MediaAsset",
  "Module",
  "NewsPost",
  "Question",
  "Quiz",
  "Resource",
  "StudentProfile",
  "Tag",
  "User",
  "Video",
]);

interface WhereArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  update?: Record<string, unknown>;
  create?: Record<string, unknown>;
}

const isSoftDeletion = (payload: Record<string, unknown>): boolean => {
  const keys = Object.keys(payload);
  return keys.length === 1 && keys[0] === "deletedAt" && payload.deletedAt instanceof Date;
};

const assertNoDeletedAt = (...payloads: (Record<string, unknown> | undefined)[]): void => {
  if (payloads.some((payload) => payload !== undefined && "deletedAt" in payload)) {
    throw new Error("deletedAt cannot be set through the soft-delete client; use delete");
  }
};

const withActiveOnly = <T extends WhereArgs>(args: T): T => ({
  ...args,
  where: { ...args.where, deletedAt: null },
});

export interface Operation {
  model: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

export const applySoftDelete = async (
  { model, operation, args, query }: Operation,
  includeDeleted: boolean,
): Promise<unknown> => {
  if (!softDeletedModels.has(model)) {
    return query(args);
  }
  const typed = args as WhereArgs;
  switch (operation) {
    case "create":
    case "createMany":
    case "createManyAndReturn":
      if (!includeDeleted) {
        const rows = (typed.data ?? {}) as Record<string, unknown> | Record<string, unknown>[];
        assertNoDeletedAt(...(Array.isArray(rows) ? rows : [rows]));
      }
      return query(args);
    case "update":
      if (includeDeleted) {
        return query(args);
      }
      if (typed.data === undefined || !isSoftDeletion(typed.data)) {
        assertNoDeletedAt(typed.data);
      }
      return query(withActiveOnly(typed));
    case "upsert":
      if (includeDeleted) {
        return query(args);
      }
      assertNoDeletedAt(typed.update, typed.create);
      return query(withActiveOnly(typed));
    case "findMany":
    case "findFirst":
    case "findFirstOrThrow":
    case "findUnique":
    case "findUniqueOrThrow":
    case "count":
    case "aggregate":
    case "groupBy":
      return query(includeDeleted ? args : withActiveOnly(typed));
    case "updateMany":
    case "updateManyAndReturn":
      if (includeDeleted) {
        return query(args);
      }
      if (typed.data === undefined || !isSoftDeletion(typed.data)) {
        assertNoDeletedAt(typed.data);
      }
      return query(withActiveOnly(typed));
    default:
      return query(args);
  }
};

interface SoftDeleteTarget {
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
}

export const softDeleteMethods = (includeDeleted: boolean) => ({
  delete(this: unknown, args: WhereArgs) {
    const context = Prisma.getExtensionContext(this) as unknown as SoftDeleteTarget;
    return context.update({
      where: includeDeleted ? args.where : withActiveOnly(args).where,
      data: { deletedAt: new Date() },
    });
  },
  deleteMany(this: unknown, args?: WhereArgs) {
    const context = Prisma.getExtensionContext(this) as unknown as SoftDeleteTarget;
    return context.updateMany({
      where: withActiveOnly(args ?? {}).where,
      data: { deletedAt: new Date() },
    });
  },
});

export const softDeleteExtension = (options: { includeDeleted: boolean }) =>
  Prisma.defineExtension({
    name: options.includeDeleted ? "soft-delete-including-deleted" : "soft-delete",
    model: Object.fromEntries(
      [...softDeletedModels].map((model) => [
        model.charAt(0).toLowerCase() + model.slice(1),
        softDeleteMethods(options.includeDeleted),
      ]),
    ) as unknown as { $allModels: Record<symbol, never> },
    query: {
      $allModels: {
        $allOperations: ({ model, operation, args, query }) =>
          applySoftDelete({ model, operation, args, query }, options.includeDeleted),
      },
    },
  });
