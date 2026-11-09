import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { applySoftDelete, softDeleteMethods, softDeletedModels } from "../src/soft-delete";

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
  const client = { user: delegate, university: delegate };
  const query = async (args: unknown) => {
    calls.push({ method: "query", args });
    return "queried";
  };
  return { calls, client, query };
};

test("reads on a soft-delete model add deletedAt null to the filter", async () => {
  const { calls, query } = recorder();

  await applySoftDelete(
    { model: "User", operation: "findMany", args: { where: { role: "ADMIN" } }, query },
    false,
  );
  await applySoftDelete({ model: "User", operation: "count", args: {}, query }, false);

  expect(calls).toEqual([
    { method: "query", args: { where: { role: "ADMIN", deletedAt: null } } },
    { method: "query", args: { where: { deletedAt: null } } },
  ]);
});

test("reads pass through unchanged when deleted rows are included", async () => {
  const { calls, query } = recorder();
  const args = { where: { role: "ADMIN" } };

  await applySoftDelete({ model: "User", operation: "findMany", args, query }, true);

  expect(calls).toEqual([{ method: "query", args }]);
});

test("delete becomes an update on the calling client that sets deletedAt", async () => {
  const { calls, client } = recorder();

  const result = await softDeleteMethods(false).delete.call(client.user, { where: { id: "1" } });

  expect(result).toBe("updated");
  expect(calls).toEqual([
    {
      method: "update",
      args: { where: { id: "1", deletedAt: null }, data: { deletedAt: expect.any(Date) } },
    },
  ]);
});

test("delete on the include-deleted client does not add the active filter", async () => {
  const { calls, client } = recorder();

  await softDeleteMethods(true).delete.call(client.user, { where: { id: "1" } });

  expect(calls).toEqual([
    { method: "update", args: { where: { id: "1" }, data: { deletedAt: expect.any(Date) } } },
  ]);
});

test("deleteMany becomes an updateMany limited to active rows", async () => {
  const { calls, client } = recorder();

  await softDeleteMethods(true).deleteMany.call(client.user, { where: { role: "STUDENT" } });
  await softDeleteMethods(false).deleteMany.call(client.user);

  expect(calls).toEqual([
    {
      method: "updateMany",
      args: { where: { role: "STUDENT", deletedAt: null }, data: { deletedAt: expect.any(Date) } },
    },
    {
      method: "updateMany",
      args: { where: { deletedAt: null }, data: { deletedAt: expect.any(Date) } },
    },
  ]);
});

test("other operations on a soft-delete model are untouched", async () => {
  const { calls, query } = recorder();
  const args = { data: { email: "a@x.bd" } };

  await applySoftDelete({ model: "User", operation: "create", args, query }, false);

  expect(calls).toEqual([{ method: "query", args }]);
});

test("models without soft delete keep normal delete and read behaviour", async () => {
  const { calls, query } = recorder();

  await applySoftDelete(
    { model: "University", operation: "delete", args: { where: { id: "1" } }, query },
    false,
  );
  await applySoftDelete({ model: "University", operation: "findMany", args: {}, query }, false);

  expect(calls).toEqual([
    { method: "query", args: { where: { id: "1" } } },
    { method: "query", args: {} },
  ]);
});

test("update and upsert add deletedAt null to the filter on the normal client", async () => {
  const { calls, query } = recorder();

  await applySoftDelete(
    { model: "User", operation: "update", args: { where: { id: "1" }, data: {} }, query },
    false,
  );
  await applySoftDelete(
    {
      model: "User",
      operation: "upsert",
      args: { where: { id: "1" }, update: {}, create: {} },
      query,
    },
    false,
  );
  expect(calls).toEqual([
    { method: "query", args: { where: { id: "1", deletedAt: null }, data: {} } },
    {
      method: "query",
      args: { where: { id: "1", deletedAt: null }, update: {}, create: {} },
    },
  ]);
});

test("deletedAt in write data is rejected on the normal client but allowed when including deleted", async () => {
  const { calls, query } = recorder();
  const data = { deletedAt: null };

  for (const operation of ["update", "updateMany", "updateManyAndReturn"]) {
    await expect(
      applySoftDelete({ model: "User", operation, args: { where: {}, data }, query }, false),
    ).rejects.toThrow(/deletedAt/);
  }
  await expect(
    applySoftDelete(
      { model: "User", operation: "upsert", args: { where: {}, update: data, create: {} }, query },
      false,
    ),
  ).rejects.toThrow(/deletedAt/);

  for (const operation of ["update", "updateMany", "upsert"]) {
    await applySoftDelete(
      { model: "User", operation, args: { where: {}, data, update: data, create: {} }, query },
      true,
    );
  }
  expect(calls).toHaveLength(3);
});

test("deletedAt in create data is rejected on the normal client but allowed when including deleted", async () => {
  const { calls, query } = recorder();
  const row = { email: "a@x.bd", deletedAt: new Date() };

  for (const [operation, data] of [
    ["create", row],
    ["createMany", [row]],
    ["createManyAndReturn", [row]],
  ] as const) {
    await expect(
      applySoftDelete({ model: "User", operation, args: { data }, query }, false),
    ).rejects.toThrow(/deletedAt/);
    await applySoftDelete({ model: "User", operation, args: { data }, query }, true);
  }
  await applySoftDelete(
    { model: "User", operation: "create", args: { data: { email: "b@x.bd" } }, query },
    false,
  );
  expect(calls).toHaveLength(4);
});

test("an update that only sets deletedAt to a date is a soft deletion and is allowed", async () => {
  const { calls, query } = recorder();

  await applySoftDelete(
    {
      model: "User",
      operation: "update",
      args: { where: { id: "1" }, data: { deletedAt: new Date() } },
      query,
    },
    false,
  );
  await expect(
    applySoftDelete(
      {
        model: "User",
        operation: "update",
        args: { where: { id: "1" }, data: { deletedAt: new Date(), email: "a@x.bd" } },
        query,
      },
      false,
    ),
  ).rejects.toThrow(/deletedAt/);

  expect(calls).toHaveLength(1);
});
