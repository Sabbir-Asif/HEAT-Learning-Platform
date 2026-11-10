import type { Prisma } from "./generated/client";

export interface EmailLookupClient {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Prisma.PrismaPromise<T>;
}

export const findUserIdsByEmail = async (
  database: EmailLookupClient,
  email: string,
): Promise<string[]> => {
  const rows = await database.$queryRaw<{ id: string }[]>`
    SELECT "id"::text AS "id" FROM "User"
    WHERE lower("email") = lower(${email.trim()}) AND "deletedAt" IS NULL`;
  return rows.map((row) => row.id);
};
