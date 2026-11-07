import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { writeOpenApiDocument } from "../../src/openapi/write-document";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "openapi-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

test("writes the document to the given path", async () => {
  const target = join(dir, "openapi.json");
  await writeOpenApiDocument(target);
  const document = JSON.parse(await readFile(target, "utf8"));
  expect(document.paths["/api/health"]).toBeDefined();
});

test("two builds from the same source are byte-identical", async () => {
  const first = join(dir, "first.json");
  const second = join(dir, "second.json");
  await writeOpenApiDocument(first);
  await writeOpenApiDocument(second);
  expect(await readFile(first, "utf8")).toBe(await readFile(second, "utf8"));
});

test("holds no timestamp, absolute path or environment value", async () => {
  const sentinel = "postgres://user:sentinel-secret@db.internal/heat";
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = sentinel;
  try {
    const target = join(dir, "openapi.json");
    await writeOpenApiDocument(target);
    const text = await readFile(target, "utf8");
    expect(text).not.toContain("sentinel-secret");
    expect(text).not.toContain(process.cwd());
    expect(text).not.toContain(homedir());
    expect(text).not.toContain(tmpdir());
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  }
});

test("the committed apps/api/openapi.json is current: run `pnpm generate` and commit it", async () => {
  const committed = await readFile(resolve(__dirname, "../../openapi.json"), "utf8");
  const target = join(dir, "fresh.json");
  await writeOpenApiDocument(target);
  expect(committed).toBe(await readFile(target, "utf8"));
});
