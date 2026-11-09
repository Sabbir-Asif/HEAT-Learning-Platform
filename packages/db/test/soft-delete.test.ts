import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { PrismaClient } from "../src/generated/client";
import { applySoftDelete, softDeletedModels } from "../src/soft-delete";

const schemaDir = join(__dirname, "..", "prisma", "schema");

const modelsWithDeletedAt = (): string[] =>
  readdirSync(schemaDir)
    .filter((file) => file.endsWith(".prisma"))
    .flatMap((file) =>
      [...readFileSync(join(schemaDir, file), "utf8").matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
        .filter((match) => /^\s*deletedAt\s+DateTime\?/m.test(match[2] ?? ""))
        .map((match) => match[1] as string),
    );

test("the soft-deleted model list matches the models that have deletedAt in the schema", () => {
  expect([...softDeletedModels].sort()).toEqual(modelsWithDeletedAt().sort());
});

const recorder = () => {
  const calls: { method: string; args: unknown }[] = [];
  const delegate = {
    update: async (args: unknown) => {
      calls.push({ method: "update", args });
      return "updated";
    },
    updateMany: async (args: unknown) => {
      calls.push({ method: "updateMany", args });
      return "updatedMany";
    },
  };
  const client = { user: delegate, university: delegate } as unknown as PrismaClient;
  const query = async (args: unknown) => {
    calls.push({ method: "query", args });
    return "queried";
  };
  return { calls, client, query };
};

test("reads on a soft-delete model add deletedAt null to the filter", async () => {
  const { calls, client, query } = recorder();

  await applySoftDelete(
    { model: "User", operation: "findMany", args: { where: { role: "ADMIN" } }, query },
    client,
    false,
  );
  await applySoftDelete({ model: "User", operation: "count", args: {}, query }, client, false);

  expect(calls).toEqual([
    { method: "query", args: { where: { role: "ADMIN", deletedAt: null } } },
    { method: "query", args: { where: { deletedAt: null } } },
  ]);
});

test("reads pass through unchanged when deleted rows are included", async () => {
  const { calls, client, query } = recorder();
  const args = { where: { role: "ADMIN" } };

  await applySoftDelete({ model: "User", operation: "findMany", args, query }, client, true);

  expect(calls).toEqual([{ method: "query", args }]);
});

test("delete becomes an update that sets deletedAt", async () => {
  const { calls, client, query } = recorder();

  const result = await applySoftDelete(
    { model: "User", operation: "delete", args: { where: { id: "1" } }, query },
    client,
    false,
  );

  expect(result).toBe("updated");
  expect(calls).toEqual([
    {
      method: "update",
      args: { where: { id: "1", deletedAt: null }, data: { deletedAt: expect.any(Date) } },
    },
  ]);
});

test("deleteMany becomes an updateMany limited to active rows", async () => {
  const { calls, client, query } = recorder();

  await applySoftDelete(
    { model: "User", operation: "deleteMany", args: { where: { role: "STUDENT" } }, query },
    client,
    true,
  );

  expect(calls).toEqual([
    {
      method: "updateMany",
      args: { where: { role: "STUDENT", deletedAt: null }, data: { deletedAt: expect.any(Date) } },
    },
  ]);
});

test("other operations on a soft-delete model are untouched", async () => {
  const { calls, client, query } = recorder();
  const args = { data: { email: "a@x.bd" } };

  await applySoftDelete({ model: "User", operation: "create", args, query }, client, false);

  expect(calls).toEqual([{ method: "query", args }]);
});

test("models without soft delete keep normal delete and read behaviour", async () => {
  const { calls, client, query } = recorder();

  await applySoftDelete(
    { model: "University", operation: "delete", args: { where: { id: "1" } }, query },
    client,
    false,
  );
  await applySoftDelete(
    { model: "University", operation: "findMany", args: {}, query },
    client,
    false,
  );

  expect(calls).toEqual([
    { method: "query", args: { where: { id: "1" } } },
    { method: "query", args: {} },
  ]);
});

test("update, upsert and delete add deletedAt null to the filter on the normal client", async () => {
  const { calls, client, query } = recorder();

  await applySoftDelete(
    { model: "User", operation: "update", args: { where: { id: "1" }, data: {} }, query },
    client,
    false,
  );
  await applySoftDelete(
    {
      model: "User",
      operation: "upsert",
      args: { where: { id: "1" }, update: {}, create: {} },
      query,
    },
    client,
    false,
  );
  await applySoftDelete(
    { model: "User", operation: "delete", args: { where: { id: "1" } }, query },
    client,
    false,
  );

  expect(calls).toEqual([
    { method: "query", args: { where: { id: "1", deletedAt: null }, data: {} } },
    {
      method: "query",
      args: { where: { id: "1", deletedAt: null }, update: {}, create: {} },
    },
    {
      method: "update",
      args: { where: { id: "1", deletedAt: null }, data: { deletedAt: expect.any(Date) } },
    },
  ]);
});

test("deletedAt in write data is rejected on the normal client but allowed when including deleted", async () => {
  const { calls, client, query } = recorder();
  const data = { deletedAt: null };

  for (const operation of ["update", "updateMany", "updateManyAndReturn"]) {
    await expect(
      applySoftDelete(
        { model: "User", operation, args: { where: {}, data }, query },
        client,
        false,
      ),
    ).rejects.toThrow(/deletedAt/);
  }
  await expect(
    applySoftDelete(
      { model: "User", operation: "upsert", args: { where: {}, update: data, create: {} }, query },
      client,
      false,
    ),
  ).rejects.toThrow(/deletedAt/);

  for (const operation of ["update", "updateMany", "upsert"]) {
    await applySoftDelete(
      { model: "User", operation, args: { where: {}, data, update: data, create: {} }, query },
      client,
      true,
    );
  }
  expect(calls).toHaveLength(3);
});
