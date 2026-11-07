import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { writeMarker } from "../../src/hooks/marker.mjs";
import { prGate } from "../../src/hooks/pr-gate.mjs";
import { ghInvocation } from "../../src/hooks/invocation.mjs";
import { addWorktree, cleanupAll, commitAll, makeRepo, tempDir, write } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

let main;
let tree;

beforeAll(() => {
  main = makeRepo({ branch: "epic/e0-x" });
  tree = addWorktree(main, "chore/30-gate");
});

const gate = (command, cwd, env = { CLAUDE_PROJECT_DIR: main }) =>
  prGate({ tool_name: "Bash", tool_input: { command }, cwd }, env);
const create = "gh pr create --base epic/e0-x --head chore/30-gate --title t --body-file b.md";

describe("without a valid marker", () => {
  test("gh pr create finds the worktree from --head, from any directory", () => {
    const denied = gate(create, main).deny;
    expect(denied).toMatch(/pnpm verify/);
    expect(denied).toContain(tree);
    expect(gate(create, tempDir("elsewhere")).deny).toContain(tree);
  });

  test("gh pr create with no --head uses the current directory's repository", () => {
    expect(gate("gh pr create --fill", tree).deny).toContain(tree);
  });

  test("an owner prefix on --head and the = form are understood", () => {
    expect(gate("gh pr create --head Sabbir-Asif:chore/30-gate", main).deny).toContain(tree);
    expect(gate("gh pr create --head=chore/30-gate", main).deny).toContain(tree);
    expect(gate("gh pr create -H chore/30-gate", main).deny).toContain(tree);
  });

  test.each([
    "cd ../elsewhere && gh pr create --fill",
    "gh -R owner/repo pr create --fill",
    "env GH_TOKEN=x gh pr create --fill",
    "pnpm lint && gh pr create --fill",
    "bash -c 'gh pr create --fill'",
    "echo $(gh pr create --fill)",
    "gh api repos/o/r/pulls -X POST -f title=x",
    "gh api repos/o/r/pulls -f title=x",
    "gh api --method POST repos/o/r/pulls",
    "gh api -X PATCH repos/o/r/pulls/5",
    "gh api repos/o/r/pulls/5/comments -F body=hi",
    "gh api repos/o/r/pulls --input body.json",
    "gh api graphql -f query='mutation { createPullRequest(input: {}) { clientMutationId } }'",
  ])("blocks %s", (command) => {
    expect(gate(command, tree).deny, command).toBeTruthy();
  });

  test.each([
    "gh pr view 3",
    "gh pr list --head chore/30-gate",
    "gh pr checks 5 --watch",
    "gh issue create --title x",
    "gh api repos/o/r/pulls/5",
    "gh api repos/o/r/pulls -X GET",
    "gh api repos/o/r/issues/5 -X POST -f body=x",
    "gh api graphql -f query='query { viewer { login } }'",
    'git commit -m "docs: explain gh pr create"',
    "echo gh pr create",
    'rg "gh pr create" docs',
    "git commit -F - <<EOF\nuse gh pr create later\nEOF",
    "cat <<'EOF'\ngh pr create\nEOF",
    "pnpm ticket move 30 review",
    "ls",
  ])("allows %j", (command) => {
    expect(gate(command, tree)).toEqual({});
  });

  test("a head branch with no worktree is blocked with a clear reason", () => {
    expect(gate("gh pr create --head chore/404-none", main).deny).toMatch(/chore\/404-none/);
    expect(gate(create, tempDir("elsewhere"), {}).deny).toMatch(/chore\/30-gate/);
  });

  test("outside any repository it blocks, because no marker can be found", () => {
    expect(gate("gh pr create --fill", tempDir("plain")).deny).toMatch(/git repository/);
  });
});

describe("with the marker", () => {
  test("a marker for the current commit and a clean tree opens the gate", () => {
    const worktree = addWorktree(main, "chore/31-ok");
    writeMarker(worktree);
    expect(gate("gh pr create --head chore/31-ok --fill", main)).toEqual({});
    expect(gate("gh api repos/o/r/pulls -f title=x", worktree)).toEqual({});
  });

  test("a commit after the marker closes it again", () => {
    const worktree = addWorktree(main, "chore/32-late");
    writeMarker(worktree);
    write(worktree, "late.txt");
    commitAll(worktree);
    expect(gate("gh pr create --head chore/32-late --fill", main).deny).toMatch(/older commit/);
  });

  test("an uncommitted change closes it too", () => {
    const worktree = addWorktree(main, "chore/33-dirty");
    writeMarker(worktree);
    write(worktree, "dirty.txt");
    expect(gate("gh pr create --head chore/33-dirty --fill", main).deny).toMatch(/uncommitted/);
  });

  test("the marker of one worktree does not open another", () => {
    const first = addWorktree(main, "chore/34-a");
    addWorktree(main, "chore/35-b");
    writeMarker(first);
    expect(gate("gh pr create --head chore/35-b --fill", main).deny).toBeTruthy();
  });
});

describe("ghInvocation", () => {
  test("separates positionals from flag values", () => {
    const command = {
      words: ["gh", "-R", "o/r", "api", "-X", "POST", "repos/o/r/pulls", "-f", "a=b"],
      cwd: "/w",
    };
    expect(ghInvocation(command)).toMatchObject({
      positional: ["api", "repos/o/r/pulls"],
      method: "POST",
      hasFields: true,
      head: null,
    });
  });

  test("is null for other programs", () => {
    expect(ghInvocation({ words: ["git"], cwd: "/w" })).toBeNull();
    expect(ghInvocation({ words: [], cwd: "/w" })).toBeNull();
  });
});
