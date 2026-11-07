import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildOpenApiDocument } from "./build-document";
import { serializeDocument } from "./serialize";

export async function writeOpenApiDocument(target: string): Promise<void> {
  const document = await buildOpenApiDocument();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, serializeDocument(document), "utf8");
}
