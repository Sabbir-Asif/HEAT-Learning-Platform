import { writeFileSync } from "node:fs";
import { readSchemaSources, renderDataModelDocument } from "../dist/er-diagram.js";

writeFileSync(
  "../../docs/data-model.md",
  renderDataModelDocument(readSchemaSources("prisma/schema")),
);
