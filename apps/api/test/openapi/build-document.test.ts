import { Controller, Get, Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { healthResponseSchema } from "@heat/contracts";
import { configureApp } from "../../src/app.setup";
import { buildOpenApiDocument, createOpenApiDocument } from "../../src/openapi/build-document";
import { ItemsController } from "./fixtures";

type Schema = Record<string, unknown>;
const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

describe("buildOpenApiDocument", () => {
  const saved = { DATABASE_URL: process.env.DATABASE_URL, REDIS_URL: process.env.REDIS_URL };
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
  });
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("describes GET /api/health with the response schema from @heat/contracts", async () => {
    const document = await buildOpenApiDocument();
    const operation = asRecord(asRecord(document.paths["/api/health"])["get"]);
    const ok = asRecord(asRecord(operation["responses"])["200"]);
    const content = asRecord(asRecord(ok["content"])["application/json"]);
    expect(content["schema"]).toEqual({ $ref: "#/components/schemas/HealthResponseDto" });

    const schema = asRecord(asRecord(document.components?.schemas)["HealthResponseDto"]);
    expect(schema).toMatchObject({
      type: "object",
      required: ["status"],
      properties: { status: { type: "string", enum: ["ok"] } },
    });
    // The literal in the spec accepts exactly what the contracts schema accepts.
    expect(healthResponseSchema.safeParse({ status: "ok" }).success).toBe(true);
    expect(healthResponseSchema.safeParse({ status: "down" }).success).toBe(false);
  });

  test("names the operation so generated hooks get readable names", async () => {
    const document = await buildOpenApiDocument();
    const operation = asRecord(asRecord(document.paths["/api/health"])["get"]);
    expect(operation["operationId"]).toBe("healthCheck");
    expect(operation["tags"]).toEqual(["health"]);
  });
});

@Injectable()
class NeedsDatabase {
  constructor() {
    throw new Error("a provider was instantiated while building the OpenAPI document");
  }
}

@Controller("probe")
class ProbeController {
  constructor(private readonly database: NeedsDatabase) {}

  @Get()
  probe() {
    return this.database;
  }
}

@Module({ controllers: [ProbeController], providers: [NeedsDatabase] })
class DatabaseBackedModule {}

test("builds the document without instantiating any provider", async () => {
  const document = await buildOpenApiDocument(DatabaseBackedModule);
  expect(Object.keys(document.paths)).toEqual(["/api/probe"]);
});

describe("createOpenApiDocument with Zod request DTOs", () => {
  async function documentFor() {
    const moduleRef = await Test.createTestingModule({ controllers: [ItemsController] }).compile();
    const app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const document = createOpenApiDocument(app);
    await app.close();
    return document;
  }

  test("shows the body schema with its constraints", async () => {
    const document = await documentFor();
    const post = asRecord(asRecord(document.paths["/api/items"])["post"]);
    expect(
      asRecord(asRecord(asRecord(post["requestBody"])["content"])["application/json"]),
    ).toEqual({
      schema: { $ref: "#/components/schemas/CreateItemDto" },
    });
    const properties = asRecord(
      asRecord(asRecord(document.components?.schemas)["CreateItemDto"])["properties"],
    );
    expect(properties["name"]).toMatchObject({ type: "string", minLength: 2, maxLength: 40 });
    expect(properties["quantity"]).toMatchObject({ type: "integer", minimum: 1, maximum: 99 });
  });

  test("shows query parameters with their constraints and default", async () => {
    const document = await documentFor();
    const get = asRecord(asRecord(document.paths["/api/items"])["get"]);
    expect(get["parameters"]).toEqual([
      expect.objectContaining({
        name: "page",
        in: "query",
        required: false,
        schema: expect.objectContaining({ type: "integer", minimum: 1, default: 1 }),
      }),
    ]);
  });

  test("shows path parameters as required with their format", async () => {
    const document = await documentFor();
    const get = asRecord(asRecord(document.paths["/api/items/{id}"])["get"]);
    expect(get["parameters"]).toEqual([
      expect.objectContaining({
        name: "id",
        in: "path",
        required: true,
        schema: expect.objectContaining({ type: "string", format: "uuid" }) as Schema,
      }),
    ]);
  });
});
