import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

const excluded = [
  /\.md$/,
  /^docs\//,
  /(^|\/)generated\//,
  /(^|\/)openapi\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /\.(png|jpe?g|gif|svg|ico|woff2?|html)$/,
];

const scriptExtensions = new Map([
  [".ts", ts.ScriptKind.TS],
  [".tsx", ts.ScriptKind.TSX],
  [".js", ts.ScriptKind.JS],
  [".mjs", ts.ScriptKind.JS],
  [".cjs", ts.ScriptKind.JS],
]);
const hashFiles =
  /(\.(ya?ml|conf|inc|example|nvmrc)|(^|\/)(CODEOWNERS|\.gitignore|\.prettierignore))$/;

const tracked = () =>
  execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((file) => !excluded.some((pattern) => pattern.test(file)));

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

function scriptComments(file, text) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptExtensions.get(extname(file)),
  );
  const found = new Set();
  const visit = (node) => {
    const children = node.getChildren(source);
    if (children.length) return children.forEach(visit);
    for (const range of ts.getLeadingCommentRanges(text, node.pos) ?? []) found.add(range.pos);
    if (node.kind !== ts.SyntaxKind.EndOfFileToken)
      for (const range of ts.getTrailingCommentRanges(text, node.end) ?? []) found.add(range.pos);
  };
  visit(source);
  return [...found];
}

function jsonComments(text) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    text,
  );
  const found = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan())
    if (
      kind === ts.SyntaxKind.SingleLineCommentTrivia ||
      kind === ts.SyntaxKind.MultiLineCommentTrivia
    )
      found.push(scanner.getTokenStart());
  return found;
}

function cssComments(text) {
  return [...text.matchAll(/\/\*/g)].map((match) => match.index);
}

function hashComments(text) {
  const found = [];
  let lineStart = 0;
  for (const line of text.split("\n")) {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quote) {
        if (char === "\\" && quote === '"') i++;
        else if (char === quote) quote = null;
      } else if ((char === '"' || char === "'") && (i === 0 || /[\s:[{,=(]/.test(line[i - 1]))) {
        quote = char;
      } else if (char === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
        found.push(lineStart + i);
        break;
      }
    }
    lineStart += line.length + 1;
  }
  return found;
}

function commentOffsets(file, text) {
  const extension = extname(file);
  if (scriptExtensions.has(extension)) return scriptComments(file, text);
  if (extension === ".json") return jsonComments(text);
  if (extension === ".css") return cssComments(text);
  if (hashFiles.test(file)) return hashComments(text);
  return [];
}

test("hand-written code, config, workflow and test files hold no comments", () => {
  const offending = tracked().flatMap((file) => {
    const text = readFileSync(resolve(root, file), "utf8");
    return commentOffsets(file, text).map((offset) => `${file}:${lineOf(text, offset)}`);
  });
  expect(offending).toEqual([]);
});

test("the checker finds comments in every supported file type", () => {
  expect(scriptComments("a.ts", "const a = 1; // note\n")).toHaveLength(1);
  expect(scriptComments("a.ts", "/** note */\nconst a = 1;\n")).toHaveLength(1);
  expect(scriptComments("a.tsx", "const a = <b>{/* note */}</b>;\n")).toHaveLength(1);
  expect(scriptComments("a.mjs", "#!/usr/bin/env node\nconst a = 1;\n")).toHaveLength(0);
  expect(scriptComments("a.mjs", 'const a = "// not a comment";\nconst b = /\\//;\n')).toHaveLength(
    0,
  );
  expect(jsonComments('{ "a": 1 // note\n}')).toHaveLength(1);
  expect(jsonComments('{ "a": "// not a comment" }')).toHaveLength(0);
  expect(cssComments("a { /* note */ }")).toHaveLength(1);
  expect(hashComments("a: 1 # note\n")).toHaveLength(1);
  expect(hashComments("# note\na: 1\n")).toHaveLength(1);
  expect(hashComments('a: "b # not a comment"\nc: Blocked by#12\n')).toHaveLength(0);
  expect(hashComments("uses: actions/checkout@abc # v1.2.3\n")).toHaveLength(1);
});
