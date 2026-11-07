import { describe, expect, test } from "vitest";
import { dangerGuard } from "../../src/hooks/danger-guard.mjs";
import { gitInvocation } from "../../src/hooks/invocation.mjs";

const bash = (command) => dangerGuard({ tool_name: "Bash", tool_input: { command }, cwd: "/tmp" });

describe("force pushes", () => {
  test.each([
    "git push --force",
    "git push -f",
    "git push origin main --force",
    "git push --force-with-lease",
    "git push --force-with-lease=main:abc",
    "git push --force-if-includes",
    "git push -fu origin x",
    "git push -uf origin x",
    "git push origin +main",
    "git push origin +HEAD:refs/heads/x",
    "git push --mirror",
    "git push --for origin x",
    "git -C ../other push --force",
    "git -c core.x=1 push -f",
    "git --no-pager push -f",
    "cd ../other && git push -f",
    "echo ok && git push --force",
    "git fetch; git push -f origin x",
    "env X=1 git push -f",
    "sudo git push -f",
    "echo $(git push -f)",
    "bash -c 'git push --force'",
    'eval "git push -f"',
    "false || git push --force",
    "git push origin x -f | tee log",
    "cat <<EOF\n$(git push -f)\nEOF",
    "echo ${x:-$(git push --force)}",
  ])("blocks %s", (command) => {
    expect(bash(command).deny).toMatch(/force-push/i);
  });

  test.each([
    "git push",
    "git push -u origin chore/25-workflow-hooks",
    "git push origin chore/25-x",
    "git push --follow-tags",
    "git push --set-upstream origin x",
    "git push --dry-run",
    "git pull --ff-only",
    "git commit -m 'never git push --force'",
    "echo git push -f",
    'rg "git push -f" docs',
    "git log --format=%H -f",
    "git status",
    "cat <<'EOF'\n$(git push -f)\nEOF",
  ])("allows %s", (command) => {
    expect(bash(command)).toEqual({});
  });
});

describe("prisma migrate reset", () => {
  test.each([
    "prisma migrate reset",
    "pnpm prisma migrate reset",
    "pnpm exec prisma migrate reset --force",
    "pnpm --filter @heat/db exec prisma migrate reset",
    "npx prisma migrate reset",
    "npx --yes prisma@latest migrate reset",
    "./node_modules/.bin/prisma migrate reset",
    "prisma --schema x.prisma migrate reset",
    "cd packages/db && pnpm exec prisma migrate  reset -f",
    "echo ok; prisma migrate reset",
    "sh -c 'prisma migrate reset'",
    "pnpm prisma db push --force-reset",
    "pnpm exec prisma db push --force-reset --accept-data-loss",
    "npx prisma db push --skip-generate --force-reset",
    "prisma db push --force-reset",
  ])("blocks %s", (command) => {
    expect(bash(command).deny).toMatch(/migrate reset|force-reset/);
  });

  test.each([
    "prisma migrate deploy",
    "prisma migrate dev --name add_users",
    "pnpm exec prisma db push",
    "echo prisma db push --force-reset",
    "pnpm exec prisma generate",
    "pnpm dev:reset",
    "pnpm dev:up",
    "echo prisma migrate reset",
    "git commit -m 'never run prisma migrate reset'",
    'rg "prisma migrate reset" docs',
  ])("allows %s", (command) => {
    expect(bash(command)).toEqual({});
  });
});

describe("gitInvocation", () => {
  test("skips global options and follows -C", () => {
    const command = {
      words: ["git", "-C", "x", "-C", "y", "-c", "a=b", "--no-pager", "push", "-u"],
      cwd: "/w",
    };
    expect(gitInvocation(command)).toEqual({ sub: "push", args: ["-u"], cwd: "/w/x/y" });
  });

  test("is null for other programs and bare git", () => {
    expect(gitInvocation({ words: ["gh", "pr"], cwd: "/w" })).toBeNull();
    expect(gitInvocation({ words: [], cwd: "/w" })).toBeNull();
    expect(gitInvocation({ words: ["git"], cwd: "/w" })).toEqual({
      sub: null,
      args: [],
      cwd: "/w",
    });
  });
});
