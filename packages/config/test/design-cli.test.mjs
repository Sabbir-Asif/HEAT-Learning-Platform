import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { requiredPairs } from "../src/design-checks.mjs";
import { contrastReport, designReport, formatRows } from "../src/design-report.mjs";

const binDir = resolve(import.meta.dirname, "../bin");

const roles = (ink, paper, mid, sunk) => {
  const colours = {};
  for (const name of [
    "background",
    "card",
    "popover",
    "primary-foreground",
    "destructive-foreground",
    "sidebar-foreground",
    "sidebar-primary",
    "sidebar-accent-foreground",
    "player-foreground",
    "sidebar-ring",
  ]) {
    colours[name] = paper;
  }
  for (const name of [
    "foreground",
    "card-foreground",
    "popover-foreground",
    "primary",
    "destructive",
    "sidebar",
    "sidebar-primary-foreground",
    "player",
    "secondary-foreground",
    "accent-foreground",
  ]) {
    colours[name] = ink;
  }
  for (const name of ["muted-foreground", "border", "input", "ring", "link", "sidebar-border"]) {
    colours[name] = mid;
  }
  Object.assign(colours, {
    secondary: sunk,
    muted: sunk,
    accent: sunk,
    divider: sunk,
    "sidebar-accent": mid,
    disabled: sunk,
    "disabled-foreground": "#aaaaaa",
  });
  for (const n of [1, 2, 3, 4, 5]) colours[`chart-${n}`] = mid;
  for (const tone of ["neutral", "info", "success", "warning", "danger", "brand"]) {
    colours[`status-${tone}`] = sunk;
    colours[`status-${tone}-foreground`] = ink;
    colours[`status-${tone}-mark`] = mid;
  }
  return colours;
};

const pairsFor = (names) => [
  ...requiredPairs(names),
  { foreground: "disabled-foreground", background: "disabled", kind: "text", exempt: "disabled" },
];

const minimalTokens = () => {
  const light = roles("#000000", "#ffffff", "#595959", "#eeeeee");
  const dark = roles("#ffffff", "#000000", "#bfbfbf", "#1a1a1a");
  return { colors: { light, dark }, pairs: pairsFor(Object.keys(light)) };
};

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "design-cli-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("formatRows", () => {
  test("prints one line per row with the ratio to two decimals, rounded down", () => {
    const text = formatRows([
      {
        theme: "light",
        foreground: "foreground",
        background: "background",
        foregroundHex: "#000000",
        backgroundHex: "#ffffff",
        kind: "text",
        required: 4.5,
        ratio: 4.4999,
        status: "fail",
      },
    ]);
    expect(text).toContain("light");
    expect(text).toContain("foreground on background");
    expect(text).toContain("4.49");
    expect(text).toContain("4.5");
    expect(text).toContain("FAIL");
  });
});

describe("contrastReport", () => {
  test("is ok for compliant colours and lists every pair for both themes", () => {
    const tokens = minimalTokens();
    const report = contrastReport(tokens, { structure: false });
    expect(report.ok).toBe(true);
    expect(report.output.split("\n").filter((l) => l.includes(" on ")).length).toBe(
      tokens.pairs.length * 2,
    );
    expect(report.output).toContain("EXEMPT");
  });

  test("names the failing pair and is not ok", () => {
    const tokens = minimalTokens();
    tokens.colors.dark.ring = "#202020";
    const report = contrastReport(tokens, { structure: false });
    expect(report.ok).toBe(false);
    expect(report.output).toMatch(/FAIL.*ring on background|ring on background.*FAIL/);
    expect(report.output).toMatch(/1\d* failing|failing/i);
  });
});

describe("designReport", () => {
  const writeDesign = ({ frames = [], files = [], tokens = minimalTokens() }) => {
    mkdirSync(join(dir, "exports"), { recursive: true });
    writeFileSync(join(dir, "tokens.json"), JSON.stringify(tokens));
    writeFileSync(join(dir, "inventory.json"), JSON.stringify({ version: 1, frames }));
    for (const file of files) writeFileSync(join(dir, "exports", file), "");
  };

  test("reports a missing export and is not ok", () => {
    writeDesign({
      frames: [
        {
          id: "student-landing-phone-light-en",
          area: "student",
          screen: "landing",
          width: "phone",
          theme: "light",
          lang: "en",
        },
      ],
    });
    const report = designReport(dir, { structure: false });
    expect(report.ok).toBe(false);
    expect(report.output).toMatch(/no export/i);
  });

  test("is ok when frames and exports match", () => {
    writeDesign({
      frames: [
        {
          id: "student-landing-phone-light-en",
          area: "student",
          screen: "landing",
          width: "phone",
          theme: "light",
          lang: "en",
        },
      ],
      files: ["student-landing-phone-light-en.png"],
    });
    expect(designReport(dir, { structure: false })).toMatchObject({ ok: true });
  });

  test("fails when a design file cannot be read", () => {
    const report = designReport(join(dir, "missing"), { structure: false });
    expect(report.ok).toBe(false);
    expect(report.output).toMatch(/tokens\.json/);
  });
});

describe("the scripts", () => {
  const run = (script, ...args) =>
    spawnSync(process.execPath, [join(binDir, script), ...args], { encoding: "utf8" });

  test("design-contrast exits 0 for a good file and prints the table", () => {
    const file = join(dir, "tokens.json");
    writeFileSync(file, JSON.stringify(minimalTokens()));
    const result = run("design-contrast.mjs", "--tokens", file, "--no-structure");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("foreground on background");
  });

  test("design-contrast exits 1 and names the pair for a bad file", () => {
    const tokens = minimalTokens();
    tokens.colors.light.input = "#dddddd";
    const file = join(dir, "tokens.json");
    writeFileSync(file, JSON.stringify(tokens));
    const result = run("design-contrast.mjs", "--tokens", file, "--no-structure");
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("input on background");
  });

  test("design-contrast exits 1 when the file is missing", () => {
    expect(run("design-contrast.mjs", "--tokens", join(dir, "none.json")).status).toBe(1);
  });

  test("design-check exits 1 on an export without an entry", () => {
    mkdirSync(join(dir, "exports"));
    writeFileSync(join(dir, "tokens.json"), JSON.stringify(minimalTokens()));
    writeFileSync(join(dir, "inventory.json"), JSON.stringify({ version: 1, frames: [] }));
    writeFileSync(join(dir, "exports", "admin-students-laptop-dark-en.png"), "");
    const result = run("design-check.mjs", "--design-dir", dir, "--no-structure");
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/no inventory entry/i);
  });
});
