import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { contextLoader } from "../../src/hooks/context-loader.mjs";
import { today } from "../../src/ticket.mjs";
import { addWorktree, cleanupAll, git, makeRepo, tempDir, write } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

const load = (cwd, source = "startup") => contextLoader({ cwd, source }).context;

describe("on a ticket branch", () => {
  test("prints the branch, the ticket, the plan path and progress", () => {
    const tree = addWorktree(makeRepo(), "chore/25-workflow-hooks");
    write(
      tree,
      "docs/plans/issue-25.md",
      "- [x] **A1** done\n  - [ ] sub\n- [X] **A2**\n- [ ] **A3**\n* [ ] not a task\n",
    );
    const text = load(tree);
    expect(text).toContain("Branch: chore/25-workflow-hooks");
    expect(text).toContain("Ticket: #25");
    expect(text).toContain("docs/plans/issue-25.md");
    expect(text).toMatch(/2 of 4 tasks ticked/);
    expect(text).toMatch(/approval/i);
    expect(text).toContain(today());
  });

  test("says when the plan does not exist yet", () => {
    const tree = addWorktree(makeRepo(), "feat/7-thing");
    expect(load(tree)).toMatch(/docs\/plans\/issue-7\.md.*missing/i);
  });

  test("works for every source and a plan with no checkboxes", () => {
    const tree = addWorktree(makeRepo(), "fix/8-bug");
    write(tree, "docs/plans/issue-8.md", "# plan\n");
    for (const source of ["startup", "resume", "clear", "compact"]) {
      expect(load(tree, source)).toMatch(/0 of 0 tasks ticked/);
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
    write(tree, "docs/plans/issue-9.md", "- [x] a\n- [ ] b\n");
    const text = load(repo);
    expect(text).toContain("chore/9-resume-me");
    expect(text).toContain(tree);
    expect(text).toMatch(/1 of 2/);
  });

  test("outside a repository it says so", () => {
    expect(load(tempDir("plain"))).toMatch(/not in a git repository/i);
  });

  test("a missing cwd falls back to the process directory without throwing", () => {
    expect(typeof contextLoader({}).context).toBe("string");
  });
});

test("the plan path is shown relative to the worktree", () => {
  const tree = addWorktree(makeRepo(), "chore/10-x");
  expect(load(tree)).toContain(join("docs", "plans", "issue-10.md"));
});
