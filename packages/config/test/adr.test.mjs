import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const adrDir = join(root, "docs/adr");
const read = (path) => readFileSync(join(root, path), "utf8");
// Links between ADR files and to the plan are checked in docs.test.mjs.

const files = readdirSync(adrDir);
const numbered = files.filter((file) => /^\d{4}-.+\.md$/.test(file));
// 0001 to 0016 are D1 to D16; 0017 is the text captcha accessibility exception.
const decisions = Array.from({ length: 16 }, (_, index) => String(index + 1).padStart(4, "0"));
const fileFor = (number) => numbered.filter((file) => file.startsWith(`${number}-`));
const adrs = [...decisions, "0017"].flatMap(fileFor);

// Section name -> body text. Optional sections are not required of every ADR.
const optional = ["Open points for the owner"];
const sectionsOf = (text) =>
  Object.fromEntries(
    text
      .split(/^## /m)
      .slice(1)
      .map((block) => {
        const [heading, ...body] = block.split("\n");
        return [heading.trim(), body.join("\n").trim()];
      }),
  );
const words = (text) => text.split(/\s+/).filter(Boolean).length;
const adr = (number) => sectionsOf(read(`docs/adr/${fileFor(number)[0]}`));

test("the template, the index and one ADR per decision D1 to D16 exist", () => {
  expect({
    template: files.includes("0000-template.md"),
    index: files.includes("README.md"),
    perNumber: decisions.map((number) => fileFor(number).length),
    captchaException: fileFor("0017").length,
  }).toEqual({
    template: true,
    index: true,
    perNumber: decisions.map(() => 1),
    captchaException: 1,
  });
});

test("every ADR has the template's sections with real content, a status, a date and a plan link", () => {
  const required = Object.keys(sectionsOf(read("docs/adr/0000-template.md"))).filter(
    (name) => !optional.includes(name),
  );
  expect(required).toEqual(["Context", "Decision", "Consequences", "Alternatives considered"]);
  const problems = adrs.flatMap((file) => {
    const text = read(`docs/adr/${file}`);
    const sections = sectionsOf(text);
    const number = file.slice(0, 4);
    const isDecision = decisions.includes(number);
    return [
      ...required
        .filter((name) => words(sections[name] ?? "") < 8)
        .map((name) => `${file}: ${name} is missing or has no content`),
      ...(/^- Status: (Proposed|Accepted|Superseded by \d{4})$/m.test(text)
        ? []
        : [`${file}: no valid status`]),
      ...(/^- Date: \d{4}-\d{2}-\d{2}$/m.test(text) ? [] : [`${file}: no date`]),
      ...(text.startsWith(`# ${number}. `) ? [] : [`${file}: title number differs from file`]),
      ...(isDecision && !text.includes(`- Plan: [D${Number(number)},`)
        ? [`${file}: plan link does not name D${Number(number)}`]
        : []),
      ...(/^- Plan: .*\]\(\.\.\/plan\//m.test(text) ? [] : [`${file}: no plan link`]),
      ...((sections["Alternatives considered"] ?? "")
        .split("\n")
        .some((line) => /^- /.test(line) && words(line) >= 8)
        ? []
        : [`${file}: no alternative with a reason`]),
    ];
  });
  expect(problems).toEqual([]);
});

test("the index links every ADR and shows the same status as the file", () => {
  const index = read("docs/adr/README.md");
  const problems = ["0000-template.md", ...adrs].flatMap((file) => {
    const row = index.split("\n").find((line) => line.includes(`](${file})`));
    if (!row) return [`${file}: not in the index`];
    if (file === "0000-template.md") return [];
    const status = read(`docs/adr/${file}`).match(/^- Status: (.+)$/m)?.[1];
    return row.includes(`| ${status} |`) ? [] : [`${file}: index status differs from the file`];
  });
  expect(problems).toEqual([]);
});

// The values the acceptance criteria name, asserted as whole phrases inside the
// section that states the decision, so a changed value cannot hide behind a mention.
test("D3 states its values in the Decision section", () => {
  const decision = adr("0003").Decision;
  const missing = [
    "`__Host-`",
    "access cookie lasts 10 minutes",
    "`SameSite=Lax`",
    "`SameSite=Strict`",
    "20-second grace window",
    "argon2id",
    "Admin TOTP is required",
  ].filter((phrase) => !decision.includes(phrase));
  expect(missing).toEqual([]);
});

test("D12 states its values in the Decision section", () => {
  const decision = adr("0012").Decision;
  const missing = [
    "per-category budgets",
    "7-day expiry for unverified registrations is counted from the actual send",
  ].filter((phrase) => !decision.includes(phrase));
  expect(missing).toEqual([]);
});

test("the captcha exception names WCAG 2.2 criterion 1.1.1 and the support contact mitigation", () => {
  const decision = adr("0017").Decision;
  const missing = ["WCAG 2.2", "criterion 1.1.1", "the form shows a support contact"].filter(
    (phrase) => !decision.includes(phrase),
  );
  expect(missing).toEqual([]);
});
