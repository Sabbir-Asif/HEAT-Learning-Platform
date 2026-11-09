import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface Field {
  name: string;
  type: string;
  list: boolean;
  optional: boolean;
  attributes: string;
}

interface Model {
  name: string;
  fields: Field[];
  compositeKey: string[];
}

const fieldPattern = /^\s*(\w+)\s+(\w+)(\[\]|\?)?\s*(.*)$/;

const parseFields = (body: string): Field[] =>
  body.split("\n").flatMap((line) => {
    if (line.trim().startsWith("@@")) return [];
    const match = fieldPattern.exec(line);
    if (!match) return [];
    const [, name = "", type = "", suffix = "", attributes = ""] = match;
    return [{ name, type, list: suffix === "[]", optional: suffix === "?", attributes }];
  });

const parseCompositeKey = (body: string): string[] => {
  const match = /@@id\(\[([^\]]*)\]/.exec(body);
  return match?.[1] ? match[1].split(",").map((part) => part.trim()) : [];
};

const parseModels = (sources: string[]): Model[] =>
  sources.flatMap((source) =>
    [...source.matchAll(/^model (\w+) \{\n([\s\S]*?)\n\}/gm)].map((match) => ({
      name: match[1] ?? "",
      fields: parseFields(match[2] ?? ""),
      compositeKey: parseCompositeKey(match[2] ?? ""),
    })),
  );

const foreignKeyFields = (field: Field): string[] => {
  const match = /fields:\s*\[([^\]]*)\]/.exec(field.attributes);
  return match?.[1] ? match[1].split(",").map((part) => part.trim()) : [];
};

const cardinality = (model: Model, field: Field, keys: string[]): string => {
  const [only] = keys;
  const unique =
    keys.length === 1 &&
    only !== undefined &&
    model.fields.some(
      (candidate) => candidate.name === only && candidate.attributes.includes("@unique"),
    );
  if (unique) return "||--o|";
  return field.optional ? "|o--o{" : "||--o{";
};

const renderColumns = (model: Model, modelNames: Set<string>): string => {
  const foreignKeys = new Set(
    model.fields.flatMap((field) => (modelNames.has(field.type) ? foreignKeyFields(field) : [])),
  );
  const lines = model.fields
    .filter((field) => !modelNames.has(field.type))
    .map((field) => {
      const marks = [
        field.attributes.includes("@id") || model.compositeKey.includes(field.name) ? "PK" : "",
        foreignKeys.has(field.name) ? "FK" : "",
      ].filter(Boolean);
      const type = field.list ? `${field.type}[]` : field.type;
      return `    ${[type, field.name, marks.join(", ")].filter(Boolean).join(" ")}`;
    });
  return `  ${model.name} {\n${lines.join("\n")}\n  }`;
};

const renderRelations = (models: Model[], modelNames: Set<string>): string[] =>
  models.flatMap((model) =>
    model.fields
      .filter((field) => modelNames.has(field.type) && foreignKeyFields(field).length > 0)
      .map(
        (field) =>
          `  ${field.type} ${cardinality(model, field, foreignKeyFields(field))} ${model.name} : ${field.name}`,
      ),
  );

export const renderEntityDiagram = (sources: string[]): string => {
  const models = parseModels(sources);
  const modelNames = new Set(models.map((model) => model.name));
  const blocks = models.map((model) => renderColumns(model, modelNames));
  return `erDiagram\n${[...blocks, ...renderRelations(models, modelNames)].join("\n")}\n`;
};

export const renderDataModelDocument = (sources: string[]): string =>
  [
    "# Data model",
    "",
    "Generated from `packages/db/prisma/schema` by `pnpm --filter @heat/db er-diagram`. Do not edit it by hand: a test fails when it is stale.",
    "",
    "```mermaid",
    renderEntityDiagram(sources).trimEnd(),
    "```",
    "",
  ].join("\n");

export const readSchemaSources = (directory: string): string[] =>
  readdirSync(directory)
    .filter((file) => file.endsWith(".prisma"))
    .sort()
    .map((file) => readFileSync(join(directory, file), "utf8"));
