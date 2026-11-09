import { afterAll, describe, expect, test } from "vitest";
import { contextLoader } from "../../src/hooks/context-loader.mjs";
import { today } from "../../src/ticket.mjs";
import { addWorktree, cleanupAll, git, makeRepo, tempDir } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

const load = (cwd, source = "startup") => contextLoader({ cwd, source }).context;

describe("on a ticket branch", () => {
  test("prints the branch and the ticket", () => {
    const tree = addWorktree(makeRepo(), "chore/25-workflow-hooks");
    const text = load(tree);
    expect(text).toContain("Branch: chore/25-workflow-hooks");
    expect(text).toContain("Ticket: #25");
    expect(text).toContain(today());
  });

  test("works for every source", () => {
    const tree = addWorktree(makeRepo(), "fix/8-bug");
    for (const source of ["startup", "resume", "clear", "compact"]) {
      expect(load(tree, source)).toContain("Ticket: #8");
    }
  });
});

describe("without a ticket branch", () => {
  test.each([["main"], ["epic/e0-engineering-foundation"]])(
    "%s prints no ticket branch",
    (branch) => {
      const repo = makeRepo({ branch });
      const text = load(repo);
      expect(text).toContain(`Branch: ${branch}`);
      expect(text).toMatch(/no ticket branch/i);
    },
  );

  test("a detached HEAD is named as such", () => {
    const repo = makeRepo();
    git(repo, "checkout", "-q", "--detach");
    expect(load(repo)).toMatch(/detached/i);
  });

  test("from the main checkout it lists the ticket worktrees to resume", () => {
    const repo = makeRepo({ branch: "epic/e0-x" });
    const tree = addWorktree(repo, "chore/9-resume-me");
    const text = load(repo);
    expect(text).toContain("chore/9-resume-me");
    expect(text).toContain(tree);
  });

  test("outside a repository it says so", () => {
    expect(load(tempDir("plain"))).toMatch(/not in a git repository/i);
  });

  test("a missing cwd falls back to the process directory without throwing", () => {
    expect(typeof contextLoader({}).context).toBe("string");
  });
});
