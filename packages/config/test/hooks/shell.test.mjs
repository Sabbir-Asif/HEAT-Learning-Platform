import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseShell } from "../../src/hooks/shell.mjs";

const base = "/work/repo";
const words = (text) => parseShell(text, base).map((command) => command.words);

describe("splitting", () => {
  test("a simple command is its words", () => {
    expect(words("git push origin main")).toEqual([["git", "push", "origin", "main"]]);
  });

  test("quoted separators stay inside one word", () => {
    expect(words('git commit -m "a && b; c | d"')).toEqual([
      ["git", "commit", "-m", "a && b; c | d"],
    ]);
    expect(words("echo 'x ; y'")).toEqual([["echo", "x ; y"]]);
  });

  test("separators split commands", () => {
    expect(words("a && b || c; d | e & f\ng")).toEqual([
      ["a"],
      ["b"],
      ["c"],
      ["d"],
      ["e"],
      ["f"],
      ["g"],
    ]);
  });

  test("escapes, line continuations and empty quotes", () => {
    expect(words("echo a\\ b")).toEqual([["echo", "a b"]]);
    expect(words("git push \\\n --force")).toEqual([["git", "push", "--force"]]);
    expect(words('echo "" x')).toEqual([["echo", "", "x"]]);
    expect(words('echo "a\\"b" "c\\\\d"')).toEqual([["echo", 'a"b', "c\\d"]]);
  });

  test("comments are dropped but a hash inside a word is kept", () => {
    expect(words("echo a # git push -f")).toEqual([["echo", "a"]]);
    expect(words("echo a#b")).toEqual([["echo", "a#b"]]);
  });

  test("reserved words and braces at the start are skipped", () => {
    expect(words("if true; then git push -f; fi")).toContainEqual(["git", "push", "-f"]);
    expect(words("{ git push -f; }")).toContainEqual(["git", "push", "-f"]);
    expect(words("! git push -f")).toContainEqual(["git", "push", "-f"]);
  });

  test("empty and blank input has no commands", () => {
    expect(words("")).toEqual([]);
    expect(words("  \n ; ")).toEqual([]);
  });
});

describe("nested commands", () => {
  test("command substitution, backticks and substitution inside double quotes are parsed", () => {
    expect(words("echo $(git push -f)")).toContainEqual(["git", "push", "-f"]);
    expect(words("echo `git push -f`")).toContainEqual(["git", "push", "-f"]);
    expect(words('echo "$(cat .env)"')).toContainEqual(["cat", ".env"]);
    expect(words("echo $(echo $(cat .env))")).toContainEqual(["cat", ".env"]);
  });

  test("single quotes hide substitutions", () => {
    expect(words("echo '$(git push -f)'")).toEqual([["echo", "$(git push -f)"]]);
  });

  test("bash -c, sh -lc and eval bodies are parsed", () => {
    expect(words('bash -c "git push -f"')).toContainEqual(["git", "push", "-f"]);
    expect(words("sh -lc 'git push -f'")).toContainEqual(["git", "push", "-f"]);
    expect(words('eval "git push" "-f"')).toContainEqual(["git", "push", "-f"]);
  });

  test("substitutions inside ${...} are parsed", () => {
    expect(words("echo ${x:-$(cat .env)}")).toContainEqual(["cat", ".env"]);
    expect(words('echo "${x:-$(cat .env)}"')).toContainEqual(["cat", ".env"]);
    expect(words("echo ${x:-`cat .env`}")).toContainEqual(["cat", ".env"]);
  });

  test("parameter expansion keeps its braces in the word", () => {
    expect(words("cat ${SCRATCH}/a b")).toEqual([["cat", "${SCRATCH}/a", "b"]]);
  });
});

describe("heredocs", () => {
  test("the body is skipped, the command after it is parsed", () => {
    const parsed = parseShell("cat <<EOF > out.txt\ngh pr create\nEOF\necho done", base);
    expect(parsed.map((c) => c.words)).toEqual([["cat"], ["echo", "done"]]);
    expect(parsed[0].writes).toEqual(["out.txt"]);
  });

  test("quoted delimiters, dash form and two heredocs on one line", () => {
    expect(words("cat <<'END'\n$(rm x)\nEND\nls")).toEqual([["cat"], ["ls"]]);
    expect(words("cat <<-END\n\tgh pr create\n\tEND\nls")).toEqual([["cat"], ["ls"]]);
    expect(words("cat <<A <<B\n1\nA\n2\nB\nls")).toEqual([["cat"], ["ls"]]);
  });

  test("substitutions inside an unquoted heredoc body are commands", () => {
    expect(words("cat <<EOF\n$(cat .env)\nEOF")).toContainEqual(["cat", ".env"]);
    expect(words("cat <<EOF\nline\n`git push -f`\nEOF")).toContainEqual(["git", "push", "-f"]);
    expect(words("cat <<-EOF\n\t$(git push -f)\n\tEOF")).toContainEqual(["git", "push", "-f"]);
    expect(words("cat <<EOF\n${x:-$(git push -f)}\nEOF")).toContainEqual(["git", "push", "-f"]);
    expect(words("cat <<EOF\n$(echo $(git push -f))\nEOF")).toContainEqual(["git", "push", "-f"]);
  });

  test("quoted delimiters and escaped substitutions stay data", () => {
    for (const text of [
      "cat <<'EOF'\n$(git push -f)\nEOF",
      'cat <<"EOF"\n$(git push -f)\nEOF',
      "cat <<\\EOF\n$(git push -f)\nEOF",
      "cat <<EOF\n\\$(git push -f)\nEOF",
      "cat <<EOF\n\\`git push -f`\nEOF",
    ]) {
      expect(words(text)).not.toContainEqual(["git", "push", "-f"]);
    }
  });

  test("an unterminated heredoc swallows the rest", () => {
    expect(words("cat <<EOF\ngh pr create")).toEqual([["cat"]]);
  });

  test("here-strings are data", () => {
    expect(words("cat <<< 'gh pr create'")).toEqual([["cat"]]);
  });
});

describe("wrappers", () => {
  test("assignments and wrappers are stripped from the front", () => {
    expect(words("env X=1 FOO=2 git push")).toEqual([["git", "push"]]);
    expect(words("FOO=1 git push")).toEqual([["git", "push"]]);
    expect(words("sudo -n git push")).toEqual([["git", "push"]]);
    expect(words("time command git push")).toEqual([["git", "push"]]);
    expect(words("nohup git push")).toEqual([["git", "push"]]);
    expect(words("env -i git push")).toEqual([["git", "push"]]);
  });

  test("a bare assignment leaves no command", () => {
    expect(words("FOO=1")).toEqual([]);
  });
});

describe("redirections", () => {
  test("output targets are collected, descriptors and duplications are not", () => {
    const [one] = parseShell("echo a > out.txt", base);
    expect(one.writes).toEqual(["out.txt"]);
    expect(parseShell("echo a >> log", base)[0].writes).toEqual(["log"]);
    expect(parseShell("echo a>out", base)[0].writes).toEqual(["out"]);
    expect(parseShell("cmd 2> err.log", base)[0].writes).toEqual(["err.log"]);
    expect(parseShell("cmd 2>/dev/null", base)[0].writes).toEqual(["/dev/null"]);
    expect(parseShell("cmd &> all.log", base)[0].writes).toEqual(["all.log"]);
    expect(parseShell("cmd >| forced", base)[0].writes).toEqual(["forced"]);
    expect(parseShell("cmd 2>&1", base)[0].writes).toEqual([]);
    expect(parseShell("cmd >&2", base)[0].writes).toEqual([]);
    expect(parseShell("cmd >&file", base)[0].writes).toEqual(["file"]);
  });

  test("input targets are collected", () => {
    expect(parseShell("cat < .env", base)[0].reads).toEqual([".env"]);
    expect(parseShell("cat <.env", base)[0].reads).toEqual([".env"]);
  });

  test("targets keep variables and substitutions as written", () => {
    expect(parseShell('echo a > "$SCRATCH/x y.md"', base)[0].writes).toEqual(["$SCRATCH/x y.md"]);
    expect(parseShell("echo a > ${SCRATCH}/a.json", base)[0].writes).toEqual(["${SCRATCH}/a.json"]);
    const parsed = parseShell("echo a > $(pwd)/f", base);
    expect(parsed.find((command) => command.words[0] === "echo").writes).toEqual(["$(pwd)/f"]);
  });

  test("a redirect with no target is ignored", () => {
    expect(parseShell("echo a >", base)[0].writes).toEqual([]);
  });
});

describe("working directory", () => {
  test("cd and pushd change the directory of later commands only", () => {
    const parsed = parseShell("echo a && cd sub && echo b && cd /abs && echo c && cd", base);
    expect(parsed.map((c) => c.cwd)).toEqual([
      base,
      base,
      resolve(base, "sub"),
      resolve(base, "sub"),
      "/abs",
      "/abs",
    ]);
    expect(parseShell("pushd x; ls", base)[1].cwd).toBe(resolve(base, "x"));
  });

  test("a directory change inside ( ... ) ends with the group", () => {
    const parsed = parseShell(
      "(cd sub && echo a); echo b; (cd x; (cd y; echo c); echo d); echo e",
      base,
    );
    const cwdOf = (word) => parsed.find((command) => command.words[1] === word).cwd;
    expect(cwdOf("a")).toBe(resolve(base, "sub"));
    expect(cwdOf("b")).toBe(base);
    expect(cwdOf("c")).toBe(resolve(base, "x/y"));
    expect(cwdOf("d")).toBe(resolve(base, "x"));
    expect(cwdOf("e")).toBe(base);
  });

  test("a stray closing parenthesis does not lose the directory", () => {
    expect(parseShell("cd sub; ) echo a", base).at(-1).cwd).toBe(resolve(base, "sub"));
  });
});
