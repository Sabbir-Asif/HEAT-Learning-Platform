import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  MAX_SVG_BYTES,
  PIXEL_DIFFERENCE_LIMIT,
  brandLocation,
  checkBrand,
  legibility,
  optimise,
  pixelDifference,
  readThemeBackgrounds,
  sanitise,
} from "../src/brand.mjs";

const root = resolve(import.meta.dirname, "../../..");
const location = brandLocation(root);
const ids = ["du-crest", "gob", "heat", "ugc", "world-bank"];
const read = (dir, name) => readFileSync(join(dir, name), "utf8");
const sourceNames = () => readdirSync(location.sourceDir).sort();
const backgrounds = readThemeBackgrounds(
  readFileSync(resolve(root, "packages/ui/src/styles.css"), "utf8"),
);

describe("brand sources", () => {
  test("there is a source for each of the five logos and no other plain name", () => {
    const plain = sourceNames()
      .filter((name) => !name.endsWith("-dark.svg"))
      .map((name) => name.replace(/\.svg$/, ""));
    expect(plain).toEqual(ids);
  });

  test("a dark variant exists only for a logo that is not legible on the dark background", () => {
    const dark = sourceNames().filter((name) => name.endsWith("-dark.svg"));
    for (const name of dark) {
      const plain = name.replace("-dark.svg", ".svg");
      expect(existsSync(join(location.sourceDir, plain))).toBe(true);
      const problems = legibility(
        optimise(read(location.sourceDir, plain)),
        backgrounds.dark,
      ).problems;
      expect({ name, plainIsIllegible: problems.length > 0 }).toEqual({
        name,
        plainIsIllegible: true,
      });
    }
  });

  test.each(ids)("%s is legible at header size in both themes", (id) => {
    const plain = optimise(read(location.sourceDir, `${id}.svg`));
    expect({ id, theme: "light", problems: legibility(plain, backgrounds.light).problems }).toEqual(
      {
        id,
        theme: "light",
        problems: [],
      },
    );
    const darkName = existsSync(join(location.sourceDir, `${id}-dark.svg`))
      ? `${id}-dark.svg`
      : `${id}.svg`;
    const dark = optimise(read(location.sourceDir, darkName));
    expect({
      id,
      theme: "dark",
      file: darkName,
      problems: legibility(dark, backgrounds.dark).problems,
    }).toEqual({
      id,
      theme: "dark",
      file: darkName,
      problems: [],
    });
  });
});

describe("every shipped file", () => {
  const sourceDirFiles = () => sourceNames().map((name) => ({ name, dir: location.sourceDir }));
  const shipped = () =>
    location.targetDirs.flatMap((dir) => readdirSync(dir).map((name) => ({ name, dir })));

  test("sources pass the sanitiser with the source cap", () => {
    for (const { name, dir } of sourceDirFiles())
      expect({ name, problems: sanitise(read(dir, name), { maxBytes: 128 * 1024 }) }).toEqual({
        name,
        problems: [],
      });
  });

  test("both apps ship the same names as the sources and pass the sanitiser with the 20 KB cap", () => {
    for (const dir of location.targetDirs) expect(readdirSync(dir).sort()).toEqual(sourceNames());
    for (const { name, dir } of shipped()) {
      expect({ dir, name, problems: sanitise(read(dir, name)) }).toEqual({
        dir,
        name,
        problems: [],
      });
      expect(Buffer.byteLength(read(dir, name))).toBeLessThanOrEqual(MAX_SVG_BYTES);
    }
  });

  test("optimising each source is strictly smaller, within the pixel limit and idempotent", () => {
    for (const { name, dir } of sourceDirFiles()) {
      const source = read(dir, name);
      const out = optimise(source);
      expect({ name, smaller: Buffer.byteLength(out) < Buffer.byteLength(source) }).toEqual({
        name,
        smaller: true,
      });
      expect({ name, difference: pixelDifference(source, out) <= PIXEL_DIFFERENCE_LIMIT }).toEqual({
        name,
        difference: true,
      });
      expect(optimise(out)).toBe(out);
    }
  });

  test("both apps hold byte-identical copies of the optimised sources", () => {
    expect(checkBrand(location)).toEqual([]);
  });
});
