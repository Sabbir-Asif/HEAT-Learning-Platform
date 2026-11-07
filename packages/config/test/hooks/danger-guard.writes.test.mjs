import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { dangerGuard } from "../../src/hooks/danger-guard.mjs";
import {
  addOrigin,
  addWorktree,
  cleanupAll,
  commitAll,
  git,
  makeRepo,
  tempDir,
  write,
} from "../fixtures/repo.mjs";

afterAll(cleanupAll);

const migration = "apps/api/prisma/migrations/001_init/migration.sql";
let main;
let withoutPlan;
let withPlan;
let outside;

beforeAll(() => {
  main = makeRepo({ files: { [migration]: "create table a();\n", "src/a.ts": "a\n" } });
  addOrigin(main, ["main"]);
  withoutPlan = addWorktree(main, "chore/7-no-plan");
  withPlan = addWorktree(main, "chore/8-with-plan");
  write(withPlan, "docs/plans/issue-8.md", "plan\n");
  outside = tempDir("outside");
});

const bash = (command, cwd) => dangerGuard({ tool_name: "Bash", tool_input: { command }, cwd });

describe("shell writes that bypass the edit guards", () => {
  test.each([
    "echo x > src/a.ts",
    "echo x >> src/a.ts",
    "printf x | tee src/a.ts",
    "sed -i 's/a/b/' src/a.ts",
    "sed -i '' -e s/a/b/ src/a.ts",
    "sed --in-place s/a/b/ src/a.ts",
    "perl -pi -e 's/a/b/' src/a.ts",
    "cp README.md src/a.ts",
    "cp -t src README.md",
    "cp --target-directory=src README.md",
    "mv src/a.ts src/b.ts",
    "rm src/a.ts",
    "rm -f src/a.ts",
    "rm -- src/a.ts",
    "rm -rf src",
    "dd if=/dev/zero of=src/a.ts",
    "install -m 644 README.md src/a.ts",
    'eval "echo x > src/a.ts"',
    'bash -c "echo x > src/a.ts"',
    "mkdir -p x && cd src && echo x > a.ts",
    "echo $(echo x > src/a.ts)",
    "cat <<EOF > src/new.ts\nx\nEOF",
    "> src/a.ts",
  ])("blocks %j on main", (command) => {
    expect(bash(command, main).deny).toMatch(/"main"/);
  });

  test("blocks absolute targets and targets reached through another cwd", () => {
    expect(bash(`rm ${join(main, "src/a.ts")}`, outside).deny).toMatch(/"main"/);
    expect(bash(`echo x > ${join(main, "src/a.ts")}`, withPlan).deny).toMatch(/"main"/);
    expect(bash("echo x > ../src/a.ts", join(main, "src")).deny).toBeTruthy();
  });

  test("blocks on a ticket branch without its plan, names the plan, allows the plan itself", () => {
    const denied = bash("echo x > src/a.ts", withoutPlan).deny;
    expect(denied).toContain("docs/plans/issue-7.md");
    expect(bash("echo x > docs/plans/issue-7.md", withoutPlan)).toEqual({});
  });

  test("allows writes once the plan exists", () => {
    expect(bash("echo x > src/a.ts && rm src/b.ts && sed -i 's/a/b/' src/a.ts", withPlan)).toEqual(
      {},
    );
  });

  test("allows writes outside any repository, to /dev/null and to $SCRATCH", () => {
    const commands = [
      `echo x > ${join(outside, "note.md")}`,
      `rm -rf ${join(outside, "dir")}`,
      "cmd > /dev/null 2>&1",
      "cmd 2>/dev/null",
      "cmd > /dev/stderr",
      'node packages/config/bin/ticket.mjs load 25 > "$SCRATCH/ticket-25.json"',
      "cat x > ${SCRATCH}/a.json",
      "cp x $SCRATCH/y",
      "cmd >&2",
      "cmd 2>&1 | tee $SCRATCH/log.txt",
      "echo x > ~/.cache/heat-hooks-test-note",
    ];
    for (const command of commands) expect(bash(command, main), command).toEqual({});
  });

  test.each([
    "echo x > $OTHER/file",
    'echo x > "$(pwd)/file"',
    "echo x > $SCRATCHY/file",
    "echo x > `pwd`/file",
    "tee $HOME_DIR/x",
    "cp a $DEST",
  ])("blocks an unexpanded variable target: %s", (command) => {
    expect(bash(command, withPlan).deny).toMatch(/Write tool/);
  });

  test("blocks writes into .env even where writes are allowed", () => {
    expect(bash("echo x > apps/api/.env", withPlan).deny).toMatch(/environment files/i);
  });

  test("does not mistake reads and the skill's normal commands for writes", () => {
    const normal = [
      "pnpm install --frozen-lockfile",
      "pnpm ticket move 25 start",
      "git fetch origin",
      "git worktree add -b chore/25-x ../heat-lp-25 origin/epic/e0-engineering-foundation",
      "git -C ../heat-lp-25 branch --unset-upstream",
      'git add -A && git commit -m "docs: add plan (#25)"',
      "git push -u origin chore/25-x",
      "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build",
      "pnpm generate",
      "pnpm format",
      "pnpm dev:reset",
      'gh issue comment 25 --body-file "$SCRATCH/plan.md"',
      'gh pr create --base epic/e0 --head chore/25-x --title "$(cat "$SCRATCH/title.txt")" --body-file "$SCRATCH/pr.md"',
      'rg "prisma migrate reset" docs',
      'git commit -m "docs: never read .env files, no --force"',
      "cat src/a.ts | head -20",
      "ls -la && pwd",
      "node -e 'console.log(1)'",
    ];
    for (const cwd of [main, withoutPlan]) {
      for (const command of normal) expect(bash(command, cwd), command).toEqual({});
    }
  });

  test("a command with no target at all is fine", () => {
    expect(bash("tee", main)).toEqual({});
    expect(bash("cp onlyone", main)).toEqual({});
    expect(bash("sed -i", main)).toEqual({});
    expect(bash("dd if=x", main)).toEqual({});
  });
});

describe("applied migrations", () => {
  let tree;

  beforeAll(() => {
    tree = addWorktree(main, "chore/9-migrations");
    write(tree, "docs/plans/issue-9.md");
  });

  const file = (name, input) => dangerGuard({ tool_name: name, tool_input: input, cwd: main });

  test("Edit and Write on a migration that exists in the base are blocked", () => {
    const path = join(tree, migration);
    expect(file("Edit", { file_path: path }).deny).toMatch(/applied migration/i);
    expect(file("Write", { file_path: path }).deny).toMatch(/applied migration/i);
  });

  test("shell writes to an applied migration or its directory are blocked", () => {
    for (const command of [
      `echo x >> ${migration}`,
      `sed -i s/a/b/ ${migration}`,
      "rm -rf apps/api/prisma/migrations/001_init",
      "rm -rf apps/api/prisma/migrations",
      `mv ${migration} /tmp/x`,
    ]) {
      expect(bash(command, tree).deny, command).toMatch(/applied migration/i);
    }
  });

  test("a migration created on this branch stays editable", () => {
    const created = "apps/api/prisma/migrations/002_new/migration.sql";
    expect(file("Write", { file_path: join(tree, created) })).toEqual({});
    write(tree, created, "create table b();\n");
    commitAll(tree);
    expect(file("Edit", { file_path: join(tree, created) })).toEqual({});
    expect(bash(`echo x >> ${created}`, tree)).toEqual({});
  });

  test("a repository without origin has no applied migrations", () => {
    const lone = makeRepo({ branch: "epic/e1-x", files: { [migration]: "a\n" } });
    expect(file("Edit", { file_path: join(lone, migration) })).toEqual({});
  });

  test("files outside migrations are unaffected", () => {
    expect(file("Edit", { file_path: join(tree, "apps/api/src/a.ts") })).toEqual({});
    expect(git(tree, "branch", "--show-current")).toBe("chore/9-migrations");
  });
});
