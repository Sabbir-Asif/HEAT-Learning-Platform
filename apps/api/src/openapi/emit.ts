import "reflect-metadata";
import { resolve } from "node:path";
import { writeOpenApiDocument } from "./write-document";

const target = resolve(__dirname, "../../openapi.json");

writeOpenApiDocument(target)
  .then(() => {
    console.log(`Wrote ${target}`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
