import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Block {
  prelude: string;
  body: string;
}

export const stylesPath = join(import.meta.dirname, "../../src/styles.css");

export function readStyles(): string {
  return readFileSync(stylesPath, "utf8");
}

export function topLevelBlocks(css: string): Block[] {
  const blocks: Block[] = [];
  let depth = 0;
  let preludeStart = 0;
  let bodyStart = 0;
  let prelude = "";
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") {
      if (depth === 0) {
        prelude = css.slice(preludeStart, index).trim();
        bodyStart = index + 1;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        blocks.push({ prelude, body: css.slice(bodyStart, index) });
        preludeStart = index + 1;
      }
    } else if (char === ";" && depth === 0) {
      preludeStart = index + 1;
    }
  }
  return blocks;
}

export function declarations(body: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const part of body.split(";")) {
    const separator = part.indexOf(":");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name.startsWith("--")) entries.set(name, part.slice(separator + 1).trim());
  }
  return entries;
}

export function blockDeclarations(css: string, prelude: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const block of topLevelBlocks(css).filter((candidate) => candidate.prelude === prelude)) {
    for (const [name, value] of declarations(block.body)) merged.set(name, value);
  }
  return merged;
}
