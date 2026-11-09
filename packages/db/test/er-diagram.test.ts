import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { readSchemaSources, renderDataModelDocument, renderEntityDiagram } from "../src/er-diagram";

const sample = `
enum Role {
  A
  B
}

model Parent {
  id   String @id @db.Uuid
  name String
  kids Child[]
}

model Child {
  id       String  @id @db.Uuid
  parentId String  @db.Uuid
  role     Role
  note     String?
  parent   Parent  @relation(fields: [parentId], references: [id])
}

model Solo {
  id       String @id @db.Uuid
  ownerId  String @unique @db.Uuid
  optId    String? @db.Uuid
  owner    Parent  @relation(fields: [ownerId], references: [id])
  optional Parent? @relation("Other", fields: [optId], references: [id])
}
`;

describe("renderEntityDiagram", () => {
  const diagram = renderEntityDiagram([sample]);

  test("starts an ER diagram", () => {
    expect(diagram.startsWith("erDiagram\n")).toBe(true);
  });

  test("lists every model with its scalar columns and marks the key", () => {
    expect(diagram).toContain("Parent {\n    String id PK\n    String name\n  }");
    expect(diagram).toContain("Role role");
  });

  test("leaves relation fields and enums out of the columns", () => {
    expect(diagram).not.toContain("Child[] kids");
    expect(diagram).not.toMatch(/^\s+enum /m);
  });

  test("draws a required foreign key as one parent to many children", () => {
    expect(diagram).toContain("Parent ||--o{ Child : parent");
  });

  test("draws a unique foreign key as one to at most one", () => {
    expect(diagram).toContain("Parent ||--o| Solo : owner");
  });

  test("draws an optional foreign key with an optional parent", () => {
    expect(diagram).toContain("Parent |o--o{ Solo : optional");
  });
});

describe("the committed data model document", () => {
  const sources = readSchemaSources("prisma/schema");

  test("reads every schema file", () => {
    expect(sources.length).toBeGreaterThanOrEqual(5);
  });

  test("shows every model in the schema", () => {
    const document = readFileSync("../../docs/data-model.md", "utf8");
    const models = sources.flatMap((source) =>
      [...source.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]),
    );

    expect(models.length).toBeGreaterThan(20);
    for (const model of models) expect(document).toContain(`  ${model} {`);
  });

  test("matches what the schema produces, so it is never stale", () => {
    const document = readFileSync("../../docs/data-model.md", "utf8");

    expect(document).toBe(renderDataModelDocument(sources));
  });
});
