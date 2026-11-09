import { Prisma, type PrismaClient } from "./generated/client";

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

const assertNoDeletedAt = (...payloads: (Record<string, unknown> | undefined)[]): void => {
  if (payloads.some((payload) => payload !== undefined && "deletedAt" in payload)) {
    throw new Error("deletedAt cannot be set through the soft-delete client; use delete");
  }
};

interface Delegate {
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
}

const withActiveOnly = <T extends WhereArgs>(args: T): T => ({
  ...args,
  where: { ...args.where, deletedAt: null },
});

const delegateOf = (client: PrismaClient, model: string): Delegate =>
  (client as unknown as Record<string, Delegate>)[model.charAt(0).toLowerCase() + model.slice(1)]!;

export interface Operation {
  model: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

export const applySoftDelete = async (
  { model, operation, args, query }: Operation,
  client: PrismaClient,
  includeDeleted: boolean,
): Promise<unknown> => {
  if (!softDeletedModels.has(model)) {
    return query(args);
  }
  const typed = args as WhereArgs;
  switch (operation) {
    case "delete":
      return delegateOf(client, model).update({
        where: includeDeleted ? typed.where : withActiveOnly(typed).where,
        data: { deletedAt: new Date() },
      });
    case "update":
      if (includeDeleted) {
        return query(args);
      }
      assertNoDeletedAt(typed.data);
      return query(withActiveOnly(typed));
    case "upsert":
      if (includeDeleted) {
        return query(args);
      }
      assertNoDeletedAt(typed.update, typed.create);
      return query(withActiveOnly(typed));
    case "deleteMany":
      return delegateOf(client, model).updateMany({
        where: withActiveOnly(typed).where,
        data: { deletedAt: new Date() },
      });
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
      assertNoDeletedAt(typed.data);
      return query(withActiveOnly(typed));
    default:
      return query(args);
  }
};

export const softDeleteExtension = (client: PrismaClient, options: { includeDeleted: boolean }) =>
  Prisma.defineExtension({
    name: options.includeDeleted ? "soft-delete-including-deleted" : "soft-delete",
    query: {
      $allModels: {
        $allOperations: ({ model, operation, args, query }) =>
          applySoftDelete({ model, operation, args, query }, client, options.includeDeleted),
      },
    },
  });
