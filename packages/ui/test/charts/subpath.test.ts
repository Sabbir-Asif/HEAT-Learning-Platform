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
        external: (id) => !id.startsWith(".") && !id.startsWith("/") && !/recharts|uppy/.test(id),
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

const hasRecharts = (modules: string[]) => modules.some((id) => /recharts/.test(id));
const hasUppy = (modules: string[]) => modules.some((id) => /@uppy/.test(id));

describe("chart and upload bundles", () => {
  test("the package root pulls in neither Recharts nor Uppy", async () => {
    const modules = await bundledModules(join(srcRoot, "index.ts"));
    expect(modules.length).toBeGreaterThan(0);
    expect(hasRecharts(modules)).toBe(false);
    expect(hasUppy(modules)).toBe(false);
    expect(modules.some((id) => /\/src\/(charts|upload)\//.test(id))).toBe(false);
  }, 60000);

  test("the charts entry pulls in Recharts and no Uppy", async () => {
    const modules = await bundledModules(join(srcRoot, "charts/index.ts"));
    expect(hasRecharts(modules)).toBe(true);
    expect(hasUppy(modules)).toBe(false);
  }, 60000);

  test("the upload entry pulls in Uppy and no Recharts", async () => {
    const modules = await bundledModules(join(srcRoot, "upload/index.ts"));
    expect(hasUppy(modules)).toBe(true);
    expect(hasRecharts(modules)).toBe(false);
  }, 60000);
});
