#!/usr/bin/env node
import { resolve } from "node:path";
import { brandLocation, buildBrand, checkBrand } from "../src/brand.mjs";

const root = resolve(import.meta.dirname, "../../..");
const location = brandLocation(root);

try {
  if (process.argv.includes("--check")) {
    const problems = checkBrand(location);
    if (problems.length) {
      console.error(
        ["Brand assets are out of date:", ...problems.map((p) => `  - ${p}`)].join("\n"),
      );
      process.exit(1);
    }
    console.log("Brand assets match their sources.");
  } else {
    const { written } = buildBrand(location);
    console.log(
      written.length ? `Updated ${written.length} file(s).` : "Brand assets already up to date.",
    );
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
