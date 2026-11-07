import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const adrDir = join(root, "docs/adr");
const read = (path) => readFileSync(join(root, path), "utf8");

const files = readdirSync(adrDir);
const numbered = files.filter((file) => /^\d{4}-.+\.md$/.test(file));
// 0001 to 0016 are D1 to D16; 0017 is the text captcha accessibility exception.
const decisions = Array.from({ length: 16 }, (_, index) => String(index + 1).padStart(4, "0"));
const fileFor = (number) => numbered.filter((file) => file.startsWith(`${number}-`));
const adrs = [...decisions, "0017"].flatMap(fileFor);
const sectionsOf = (text) => text.match(/^## .+$/gm) ?? [];

test("the template, the index and one ADR per decision D1 to D16 exist", () => {
  const perNumber = decisions.map((number) => fileFor(number).length);
  expect({
    template: files.includes("0000-template.md"),
    index: files.includes("README.md"),
    perNumber,
    captchaException: fileFor("0017").length,
  }).toEqual({
    template: true,
    index: true,
    perNumber: decisions.map(() => 1),
    captchaException: 1,
  });
});

test("every ADR has the template's sections, a status, a date, a plan link and an alternative", () => {
  const required = sectionsOf(read("docs/adr/0000-template.md"));
  expect(required.length).toBeGreaterThan(0);
  const problems = adrs.flatMap((file) => {
    const text = read(`docs/adr/${file}`);
    const missing = required.filter((section) => !sectionsOf(text).includes(section));
    const alternatives = text.split(/^## Alternatives considered$/m)[1] ?? "";
    return [
      ...missing.map((section) => `${file}: missing ${section}`),
      ...(/^- Status: (Proposed|Accepted|Superseded by \d{4})$/m.test(text)
        ? []
        : [`${file}: no valid status`]),
      ...(/^- Date: \d{4}-\d{2}-\d{2}$/m.test(text) ? [] : [`${file}: no date`]),
      ...(/^- Plan: .*\]\(\.\.\/plan\//m.test(text) ? [] : [`${file}: no plan link`]),
      ...(/^- \S/m.test(alternatives) ? [] : [`${file}: no alternative listed`]),
    ];
  });
  expect(problems).toEqual([]);
});

test("the index links every ADR and the template", () => {
  const index = read("docs/adr/README.md");
  const unlinked = ["0000-template.md", ...adrs].filter((file) => !index.includes(`](${file})`));
  expect(unlinked).toEqual([]);
});

test("relative links in the ADRs resolve and plan anchors exist in the plan", () => {
  const plan = read("docs/plan/heat-lms-project-plan.html");
  const broken = ["README.md", "0000-template.md", ...adrs].flatMap((file) => {
    const links = [...read(`docs/adr/${file}`).matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    return links
      .filter((link) => !/^[a-z]+:/.test(link))
      .filter((link) => {
        const [path, anchor] = link.split("#");
        if (!existsSync(resolve(adrDir, dirname(file), path))) return true;
        return path.endsWith(".html") && anchor ? !plan.includes(`id="${anchor}"`) : false;
      })
      .map((link) => `${file}: ${link}`);
  });
  expect(broken).toEqual([]);
});

test("the acceptance-criteria values are present in D3, D12 and the captcha exception", () => {
  const expected = {
    "0003": ["10-minute", "20-second", "argon2id", "TOTP"],
    "0012": ["per-category budgets", "7-day expiry", "actual send"],
    "0017": ["WCAG 2.2", "1.1.1", "support contact"],
  };
  const missing = Object.entries(expected).flatMap(([number, strings]) => {
    const text = read(`docs/adr/${fileFor(number)[0]}`);
    return strings.filter((value) => !text.includes(value)).map((v) => `${number}: ${v}`);
  });
  expect(missing).toEqual([]);
});
