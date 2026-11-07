import { describe, expect, test } from "vitest";
import { envAccess, isEnvFile } from "../../src/hooks/env-files.mjs";
import { parseShell } from "../../src/hooks/shell.mjs";

describe("isEnvFile", () => {
  test.each([
    ".env",
    "apps/api/.env",
    "/abs/.env.local",
    ".env.production",
    ".ENV",
    "prod.env",
    "deploy/staging.ENV",
    ".envrc",
    "./.env",
    ".env*",
    ".env.*",
    "dir/.env/",
  ])("%s is an env file", (path) => {
    expect(isEnvFile(path)).toBe(true);
  });

  test.each([
    ".env.example",
    "apps/api/.env.example",
    ".ENV.EXAMPLE",
    "environment.ts",
    "env.ts",
    "src/.environment",
    "README.md",
    "",
    "dotenv",
  ])("%s is not", (path) => {
    expect(isEnvFile(path)).toBe(false);
  });
});

describe("envAccess", () => {
  const find = (text) => envAccess(parseShell(text, "/w"));

  test.each([
    "cat .env",
    "less apps/api/.env.local",
    "head -n 3 .env",
    "tail .envrc",
    "source .env",
    ". ./.env",
    "rg SECRET .env",
    "grep -r KEY prod.env",
    "cp .env /tmp/leak",
    "base64 .env",
    "cat < .env",
    "cat<.env",
    "echo hi > .env",
    "echo $(cat .env)",
    'echo "$(cat .env)"',
    "bash -c 'cat .env'",
    "env X=1 cat .env",
    "sed -n 1p .env",
    "docker run --env-file=.env x",
    "dd if=.env",
    "find . -name .env -exec cat {} +",
    "cat .ENV",
  ])("denies %s", (text) => {
    expect(find(text)).toBeTruthy();
  });

  test.each([
    "cat .env.example",
    "git add .env.example",
    "git status --short .env",
    "git check-ignore .env",
    "ls -la .env",
    "git commit -m 'never read .env files'",
    'git commit -m "docs: mention .env and .envrc"',
    "rg -g '!.env' foo",
    "rg '\\.env' src",
    "pnpm dev:up",
    "echo done",
    "rm .env",
    "test -f .env",
    "[ -f .env ]",
    "cat README.md",
  ])("allows %s", (text) => {
    expect(find(text)).toBeNull();
  });

  test("names the path it found", () => {
    expect(find("cat apps/api/.env")).toBe("apps/api/.env");
  });
});
