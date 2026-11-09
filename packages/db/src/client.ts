import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";
import { softDeleteExtension } from "./soft-delete";

export const createClient = (connectionString: string) => {
  const base = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const includingDeleted = base.$extends(softDeleteExtension(base, { includeDeleted: true }));
  return base.$extends(softDeleteExtension(base, { includeDeleted: false })).$extends({
    client: {
      $includingDeleted: () => includingDeleted,
    },
  });
};

export type HeatClient = ReturnType<typeof createClient>;
