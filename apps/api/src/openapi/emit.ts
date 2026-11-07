import "reflect-metadata";
import { resolve } from "node:path";
import { writeOpenApiDocument } from "./write-document";

// Run from the build output (`pnpm --filter api openapi`): dist/openapi/emit.js writes apps/api/openapi.json.
const target = resolve(__dirname, "../../openapi.json");

writeOpenApiDocument(target)
  .then(() => {
    console.log(`Wrote ${target}`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
