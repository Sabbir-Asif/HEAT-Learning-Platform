import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
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
  const find = (text, cwd = "/w") => envAccess(parseShell(text, cwd), text);

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

  test.each([
    "grep -eSECRET .env",
    "grep --regexp=SECRET .env",
    "grep -f x .env",
    "grep --file=x .env",
    "grep -f .env patterns.txt",
    "rg --file x .env",
    "rg -fx .env",
    "grep -rne SECRET .env",
    "grep -ie SECRET apps/api/.env",
    "grep -e SECRET -- .env",
    "rg -e one -e two .env.local",
  ])("a search that supplies its own pattern still reads the file: %s", (text) => {
    expect(find(text)).toBeTruthy();
  });

  test("the same flags on a bare file that exists", () => {
    const dir = tempDir("envcwd2");
    writeFileSync(join(dir, "prod.env"), "x\n");
    expect(find("rg --regexp=SECRET prod.env", dir)).toBe("prod.env");
    expect(find("grep -eSECRET prod.env", dir)).toBe("prod.env");
  });

  test.each([
    "grep -e process.env -e import.meta.env src",
    "grep -eprocess.env src",
    "rg --regexp=process.env src",
    "grep -rne process.env src",
    "grep -f patterns.txt src",
    "rg --file patterns.txt apps",
  ])("a search whose pattern mentions process.env is still allowed: %s", (text) => {
    expect(find(text)).toBeNull();
  });

  test.each([
    "cat *.env",
    "cat prod.e?v",
    "cat .e*",
    "cat .*",
    "cat apps/*/.env",
    "cat config/*.env",
    "cat prod.e[n]v",
    "head -n1 stag*.env",
  ])("a glob that can match an env file is denied: %s", (text) => {
    expect(find(text)).toBeTruthy();
  });

  test.each([
    "cat *",
    "cat ?",
    "cat *.txt",
    "cat src/*.ts",
    "cat [ab].md",
    "ls *.env",
    "cat README.m?",
    "rg 'a*.env' src",
  ])("an ordinary glob is allowed: %s", (text) => {
    expect(find(text)).toBeNull();
  });

  describe("globs against the real directory", () => {
    const touch = (dir, relative) => {
      mkdirSync(join(dir, relative, ".."), { recursive: true });
      writeFileSync(join(dir, relative), "x\n");
    };

    const plainDir = () => {
      const dir = tempDir("globplain");
      for (const file of [
        "docs/adr/0013-x.md",
        "apps/frontend-public/postcss.config.mjs",
        "src/a.ts",
        "README.md",
        "empty/keep.txt",
      ]) {
        touch(dir, file);
      }
      return dir;
    };

    const envDir = () => {
      const dir = plainDir();
      for (const file of [
        ".env",
        ".envrc",
        "foo.env",
        "foobar.txt",
        "plain.txt",
        "sub/prod.env",
        "other/prod.env",
        "deep/inner/.env",
        "c/d/.env",
        "~name/.env",
        "sub/.extra/.env",
      ]) {
        touch(dir, file);
      }
      symlinkSync(".env", join(dir, "link"));
      symlinkSync(join(dir, "deep/inner"), join(dir, "empty/lk"));
      return dir;
    };

    test.each([
      "cat foo*",
      "cat docs/adr/0013*",
      "cat docs/adr/0013.*",
      "cat apps/frontend-public/postcss*",
      "cat src/*.ts",
      "cat *.md",
      "cat *",
      "cat ?",
      "cat .e*x",
      "wc -l docs/adr/*",
      "wc -l docs/adr/0013*",
      "head -n 3 docs/adr/0013*",
      "grep KEY docs/adr/0013*",
      "cat s*/a*",
      "cat foo*; wc -l docs/adr/*",
      "cat foo*\ncat docs/adr/0013*",
      "cat foo* 2>&1",
      "grep KEY foo* 2>/dev/null",
    ])("a plain reader on a glob with no env match is allowed: %s", (text) => {
      expect(find(text, plainDir()), text).toBeNull();
    });

    test.each([
      "cat foo*",
      "cat docs/adr/0013*",
      "cat apps/*/prod*",
      "cat */prod*",
      "cat prod*",
      "rg foo docs/adr/0013*",
      "git log --oneline -- docs/adr/0013*",
    ])("without a readable directory the name check applies: %s", (text) => {
      expect(find(text, "/w"), text).toBeTruthy();
    });

    test.each([
      "cat foo*",
      "cat *.env",
      "cat .env*",
      "cat .e*",
      "cat .*",
      "cat .ENV*",
      "cat lin?",
      "cat ?env",
      "cat [.]env",
      "cat .[!x]*",
      "cat .e[[:alpha:]]v",
      "cat .[]e]nv",
      "cat .{e,x}nv",
      "cat {.e,.x}nv",
      "cat .e{n,x}v",
      "cat .{a..f}nv",
      "cat */prod*",
      "cat s*/prod*",
      "cat sub/prod*",
      "cat o*/prod.en?",
      "shopt -s dotglob; cat ?env",
      "GLOBIGNORE=x; cat ?env",
      "cat $PWD/prod*",
      'cat "$PWD"/prod*',
      "grep KEY .e*",
      "tail -n1 .e*",
      "cat *",
      "cat ?*",
      "cat ~name/.e*",
      "cat ./~name/.e*",
    ])("a glob that really matches an env file is denied: %s", (text) => {
      expect(find(text, envDir()), text).toBeTruthy();
    });

    test("a leading ~/ is resolved to the home directory", () => {
      const home = tempDir("globhome");
      touch(home, "prod.env");
      const saved = process.env.HOME;
      process.env.HOME = home;
      try {
        expect(find("cat ~/prod*", plainDir())).toBeTruthy();
        expect(find("cat ~/nothing*", plainDir())).toBeNull();
      } finally {
        process.env.HOME = saved;
      }
    });

    test.each([
      "cat plain*",
      "cat foobar*",
      "cat *.txt",
      "cat nothing*",
      "cat docs/adr/0013*",
      "cat [!x]*.txt",
      "cat .e[[:digit:]]v",
    ])("a glob with no env match in the real directory is allowed: %s", (text) => {
      expect(find(text, envDir()), text).toBeNull();
    });

    test.each([
      "cd docs; find .. -name '.e*' -exec cat {} +",
      "cd docs; rg -uu -g '.e*' KEY ..",
      "cd docs; tar xf x.tar; cat .e*",
      "cd docs; unzip x.zip && cat .e*",
      "git checkout -- . && cat .e*",
      "cp a b; cat .e*",
      "touch .env; cat .e*",
      "echo hi > out.txt; cat .e*",
      "grep -r KEY .e*",
      "grep -rn KEY foo*",
      "xargs -a list rg KEY .e*",
      "grep --directories=recurse foo s*",
      "grep -d recurse foo s*",
      "grep -drecurse foo s*",
      "diff -rN s* e*",
      "diff -r s* e*",
      "diff --new-file s* e*",
    ])("the real listing is not trusted here: %s", (text) => {
      expect(find(text, plainDir()), text).toBeTruthy();
    });

    test.each([
      "false && cd empty; cat .e*",
      "true || cd empty; cat .e*",
      "cd empty | cat .e*",
      "env cd empty; cat .e*",
      "CDPATH=a cd b; cat .e*",
      "cd -- -x; cat .e*",
      "cd empty; cat .e*",
      "chdir ..; cat .en*",
      "chdir empty; cat .e*",
      "cd empty && cat .e*",
      "pushd empty >/dev/null; cat .e*",
      "pushd empty >/dev/null; popd >/dev/null; cat .e*",
      "cd docs; cd -; cat .e*",
      "c''d empty; cat .e*",
      "(cd empty; cat .e*)",
      "{ cd empty; cat .e*; }",
      "cd $X; cat .e*",
      "cat .e* | head",
      "cat .e* &",
      "echo $(cat .e*)",
      "CDPATH=a; cat .e*",
      "cd empty/lk; cat ../.e*",
      "cat **/.e*",
      "cat ***/.e*",
      "cat c/**/.e*",
      "cat ./**/.e*",
      "cat foo**",
    ])("an untrusted command falls back to the name check: %s", (text) => {
      expect(find(text, plainDir()), text).toBeTruthy();
      expect(find(text, envDir()), text).toBeTruthy();
    });

    test.each([
      "grep --rec foo s*",
      "grep --recur foo s*",
      "grep --recursive foo s*",
      "grep --dereference-recursive foo s*",
      "grep --dir=recurse foo s*",
      "grep --directories=recurse foo s*",
      "grep --directories recurse foo s*",
      "grep --d=recurse foo s*",
      "grep -r foo s*",
      "grep -R foo s*",
      "grep -rn foo s*",
      "grep -nr foo s*",
      "grep -nrH foo s*",
      "grep -d recurse foo s*",
      "grep -drecurse foo s*",
      "grep --unknown-future-flag foo s*",
      "egrep --rec foo s*",
      "fgrep --rec foo s*",
      "diff --rec s* e*",
      "diff --new s* e*",
      "diff -rN s* e*",
      "diff -Nr s* e*",
      "diff -r s* e*",
    ])("a reader that can recurse is not trusted: %s", (text) => {
      expect(find(text, envDir()), text).toBeTruthy();
    });

    test.each([
      "grep foo s*",
      "grep -n foo s*",
      "grep -in foo s*",
      "grep --ignore-case foo s*",
      "grep --line-number --count foo s*",
      "grep --color=never foo s*",
      "grep -e foo -- s*",
      "diff --brief src/a.ts src/a.ts",
      "diff -u s*",
    ])("a reader without recursion flags keeps the listing: %s", (text) => {
      expect(find(text, envDir()), text).toBeNull();
    });

    test("a command with cd or a pipe never gets the listing even for a harmless glob", () => {
      const dir = plainDir();
      expect(find("cd docs; cat adr/0013*", dir)).toBeTruthy();
      expect(find("cat docs/adr/0013* | head", dir)).toBeTruthy();
      expect(find("cat docs/adr/0013* && true", dir)).toBeTruthy();
    });

    test("a .. segment after a symlinked directory falls back, a real one does not", () => {
      const dir = envDir();
      expect(find("cat empty/lk/../.e*", dir)).toBeTruthy();
      expect(find("cat docs/../src/a*", plainDir())).toBeNull();
    });
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
