import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { cleanupAll, tempDir } from "../fixtures/repo.mjs";
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

afterAll(cleanupAll);

describe("envAccess", () => {
  const find = (text, cwd = "/w") => envAccess(parseShell(text, cwd));

  test.each([
    "cat .env",
    "less apps/api/.env.local",
    "head -n 3 .env",
    "tail .envrc",
    "source .env",
    ". ./.env",
    "rg SECRET .env",
    "cp .env /tmp/leak",
    "base64 .env",
    "cat < .env",
    "cat<.env",
    "grep -r KEY ./prod.env",
    "cat config/staging.env",
    "rg -e KEY .env",
    "git grep KEY -- .env",
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
    "rg process.env",
    "rg process.env apps/api/src",
    "grep -rn process.env apps",
    "grep -rn 'next.env' .",
    "git grep process.env",
    "git grep -n import.meta.env -- apps",
    "rg import.meta.env",
    "rg -e process.env -e import.meta.env src",
    "git log -S process.env",
    "git log -G import.meta.env --oneline",
    "git log -Sprocess.env",
    "egrep -n 'process.env' src",
    "echo process.env",
  ])("allows %s", (text) => {
    expect(find(text)).toBeNull();
  });

  test("a bare name ending in .env is an env file when it exists on disk", () => {
    const dir = tempDir("envcwd");
    writeFileSync(join(dir, "prod.env"), "x\n");
    expect(find("cat prod.env", dir)).toBe("prod.env");
    expect(find("grep -r KEY staging.env", dir)).toBeNull();
    expect(find("cat process.env", dir)).toBeNull();
  });

  test("names the path it found", () => {
    expect(find("cat apps/api/.env")).toBe("apps/api/.env");
  });
});
