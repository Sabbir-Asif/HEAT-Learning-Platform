import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checkInventory, contrastRows, failingRows, validateTokens } from "./design-checks.mjs";

const floorTo2 = (value) => (Math.floor(value * 100) / 100).toFixed(2);

export function formatRows(rows) {
  const lines = rows.map((row) =>
    [
      row.theme.padEnd(5),
      `${row.foreground} on ${row.background}`.padEnd(52),
      `${row.foregroundHex} ${row.backgroundHex}`.padEnd(17),
      row.kind.padEnd(10),
      `${floorTo2(row.ratio)} of ${row.required}`.padEnd(14),
      row.status.toUpperCase(),
    ].join("  "),
  );
  return lines.join("\n");
}

export function contrastReport(tokens, { structure = true } = {}) {
  if (structure) {
    const problems = validateTokens(tokens);
    if (problems.length) {
      return {
        ok: false,
        output: ["Token file problems:", ...problems.map((p) => `  - ${p}`)].join("\n"),
      };
    }
  }
  const rows = contrastRows(tokens);
  const failing = failingRows(rows);
  const exempt = rows.filter((row) => row.status === "exempt").length;
  const summary = failing.length
    ? `${failing.length} failing of ${rows.length} pair checks`
    : `All ${rows.length - exempt} pair checks pass (${exempt} exempt)`;
  return { ok: failing.length === 0, output: `${formatRows(rows)}\n\n${summary}` };
}

function readJson(path) {
  try {
    return { value: JSON.parse(readFileSync(path, "utf8")) };
  } catch (error) {
    return { error: `Cannot read ${path}: ${error.message}` };
  }
}

function listExports(designDir) {
  try {
    return readdirSync(join(designDir, "exports"));
  } catch {
    return [];
  }
}

export function designReport(designDir, { structure = true } = {}) {
  const tokens = readJson(join(designDir, "tokens.json"));
  const inventory = readJson(join(designDir, "inventory.json"));
  const unreadable = [tokens.error, inventory.error].filter(Boolean);
  if (unreadable.length) return { ok: false, output: unreadable.join("\n") };

  const failures = [];
  if (structure) failures.push(...validateTokens(tokens.value));
  if (!failures.length) {
    failures.push(
      ...failingRows(contrastRows(tokens.value)).map(
        (row) =>
          `${row.theme}: ${row.foreground} on ${row.background} is ${floorTo2(row.ratio)}, needs ${row.required}`,
      ),
    );
  }
  const exportFiles = listExports(designDir);
  failures.push(...checkInventory(inventory.value, exportFiles));
  const frames = Array.isArray(inventory.value?.frames) ? inventory.value.frames.length : 0;
  return failures.length
    ? {
        ok: false,
        output: ["Design checks failed:", ...failures.map((f) => `  - ${f}`)].join("\n"),
      }
    : {
        ok: true,
        output: `Design checks passed: tokens, contrast and ${frames} frames with exports`,
      };
}
