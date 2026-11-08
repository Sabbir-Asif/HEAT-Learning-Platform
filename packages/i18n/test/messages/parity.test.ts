import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { checkParity, messages } from "../../src/index";

const messagesDir = resolve(import.meta.dirname, "../../src/messages");

function namespaceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.isDirectory())
        return existsSync(join(dir, entry.name, "index.ts")) ? [entry.name] : [];
      return entry.name.endsWith(".ts") && entry.name !== "index.ts"
        ? [entry.name.slice(0, -3)]
        : [];
    })
    .sort();
}

function compareNamespaceFiles(
  enDir: string,
  bnDir: string,
  exported: { en: string[]; bn: string[] },
) {
  const en = namespaceFiles(enDir);
  const bn = namespaceFiles(bnDir);
  return {
    onlyInEn: en.filter((name) => !bn.includes(name)),
    onlyInBn: bn.filter((name) => !en.includes(name)),
    notExportedByEn: en.filter((name) => !exported.en.includes(name)),
    notExportedByBn: bn.filter((name) => !exported.bn.includes(name)),
  };
}

const none = { onlyInEn: [], onlyInBn: [], notExportedByEn: [], notExportedByBn: [] };

describe("catalog parity", () => {
  test("bn defines exactly the keys of en, with no empty value and the same placeholders", () => {
    expect(checkParity(messages.en, messages.bn)).toEqual({
      missing: [],
      extra: [],
      empty: [],
      placeholders: [],
    });
  });

  test("every namespace file exists in both languages and is exported by both aggregates", () => {
    expect(
      compareNamespaceFiles(join(messagesDir, "en"), join(messagesDir, "bn"), {
        en: Object.keys(messages.en),
        bn: Object.keys(messages.bn),
      }),
    ).toEqual(none);
  });

  test("the namespace comparison names a file present in one language only or not exported", () => {
    const root = mkdtempSync(join(tmpdir(), "heat-i18n-"));
    const enDir = join(root, "en");
    const bnDir = join(root, "bn");
    mkdirSync(enDir);
    mkdirSync(bnDir);
    for (const name of ["brand.ts", "index.ts", "common.ts"]) writeFileSync(join(enDir, name), "");
    for (const name of ["brand.ts", "index.ts", "forms.ts"]) writeFileSync(join(bnDir, name), "");
    expect(compareNamespaceFiles(enDir, bnDir, { en: ["brand"], bn: ["brand", "forms"] })).toEqual({
      onlyInEn: ["common"],
      onlyInBn: ["forms"],
      notExportedByEn: ["common"],
      notExportedByBn: [],
    });
  });

  test("the namespace comparison also finds a namespace kept in a directory", () => {
    const root = mkdtempSync(join(tmpdir(), "heat-i18n-"));
    const enDir = join(root, "en");
    const bnDir = join(root, "bn");
    for (const dir of [enDir, bnDir]) mkdirSync(dir);
    for (const name of ["brand.ts", "index.ts"]) {
      writeFileSync(join(enDir, name), "");
      writeFileSync(join(bnDir, name), "");
    }
    mkdirSync(join(enDir, "courses"));
    writeFileSync(join(enDir, "courses", "index.ts"), "");
    mkdirSync(join(bnDir, "forms"));
    writeFileSync(join(bnDir, "forms", "index.ts"), "");
    mkdirSync(join(enDir, "empty"));
    expect(compareNamespaceFiles(enDir, bnDir, { en: ["brand"], bn: ["brand", "forms"] })).toEqual({
      onlyInEn: ["courses"],
      onlyInBn: ["forms"],
      notExportedByEn: ["courses"],
      notExportedByBn: [],
    });
  });

  test("the aggregates hold the same namespaces", () => {
    expect(Object.keys(messages.bn).sort()).toEqual(Object.keys(messages.en).sort());
    expect(Object.keys(messages.en).sort()).toEqual(["brand", "site"]);
  });
});
