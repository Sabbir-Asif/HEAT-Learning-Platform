export interface OrderQueryClient {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}

type HighestRows = { highest: number | null }[];

const firstHighest = (rows: unknown): number | null => (rows as HighestRows)[0]?.highest ?? null;

export const highestVideoOrder = async (
  client: OrderQueryClient,
  moduleId: string,
): Promise<number | null> =>
  firstHighest(
    await client.$queryRaw`select max("order") as highest from "Video" where "moduleId" = ${moduleId}::uuid`,
  );

export const highestModuleOrder = async (
  client: OrderQueryClient,
  revisionId: string,
): Promise<number | null> =>
  firstHighest(
    await client.$queryRaw`select max("order") as highest from "Module" where "revisionId" = ${revisionId}::uuid`,
  );

export const highestLessonSectionOrder = async (
  client: OrderQueryClient,
  moduleId: string,
): Promise<number | null> =>
  firstHighest(
    await client.$queryRaw`select max("order") as highest from "LessonSection" where "moduleId" = ${moduleId}::uuid`,
  );
