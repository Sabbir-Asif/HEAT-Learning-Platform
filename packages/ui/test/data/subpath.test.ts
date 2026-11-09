import { join } from "node:path";
import { build } from "vite";
import { describe, expect, test } from "vitest";

const srcRoot = join(import.meta.dirname, "../../src");

async function bundledModules(entry: string): Promise<string[]> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ["es"], fileName: "out" },
      rollupOptions: {
        external: (id) => !id.startsWith(".") && !id.startsWith("/") && !/tanstack|nuqs/.test(id),
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  return outputs.flatMap((output) =>
    "output" in output
      ? output.output.flatMap((chunk) => (chunk.type === "chunk" ? Object.keys(chunk.modules) : []))
      : [],
  );
}

describe("subpath bundles", () => {
  test("the package root pulls in no table library, no URL library and no data code", async () => {
    const modules = await bundledModules(join(srcRoot, "index.ts"));
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.filter((id) => /@tanstack|nuqs|\/src\/data\//.test(id))).toEqual([]);
  }, 60000);

  test("the data entry does pull them in", async () => {
    const modules = await bundledModules(join(srcRoot, "data/index.ts"));
    expect(modules.some((id) => /@tanstack/.test(id))).toBe(true);
    expect(modules.some((id) => /nuqs/.test(id))).toBe(true);
  }, 60000);
});
