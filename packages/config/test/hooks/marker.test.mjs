import { readFileSync } from "node:fs";
import { afterAll, expect, test } from "vitest";
import { markerPath, markerStatus, writeMarker } from "../../src/hooks/marker.mjs";
import { addWorktree, cleanupAll, commitAll, makeRepo, write } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

test("without a marker the status says so", () => {
  const repo = makeRepo();
  expect(markerStatus(repo)).toEqual({
    valid: false,
    reason: expect.stringMatching(/no verification marker/i),
  });
});

test("a marker for HEAD on a clean tree is valid", () => {
  const repo = makeRepo();
  writeMarker(repo);
  expect(markerStatus(repo)).toEqual({ valid: true });
});

test("a commit after the marker invalidates it", () => {
  const repo = makeRepo();
  writeMarker(repo);
  write(repo, "a.txt");
  commitAll(repo);
  expect(markerStatus(repo)).toEqual({
    valid: false,
    reason: expect.stringMatching(/older commit/i),
  });
});

test.each(["new-file.txt", "README.md"])("uncommitted change %s invalidates it", (file) => {
  const repo = makeRepo();
  writeMarker(repo);
  write(repo, file, "changed\n");
  expect(markerStatus(repo)).toEqual({
    valid: false,
    reason: expect.stringMatching(/uncommitted/i),
  });
});

test("the marker lives in the worktree's own git directory and is never part of the tree", () => {
  const repo = makeRepo();
  const tree = addWorktree(repo, "chore/1-x");
  writeMarker(tree);
  expect(markerPath(tree)).toContain(".git/worktrees/");
  expect(readFileSync(markerPath(tree), "utf8").trim()).toMatch(/^[0-9a-f]{40}$/);
  expect(markerStatus(tree).valid).toBe(true);
  expect(markerStatus(repo).valid).toBe(false);
});

test("a garbled marker is not valid", () => {
  const repo = makeRepo();
  writeMarker(repo);
  write(markerPath(repo), "", "zzz\n");
  expect(markerStatus(repo).valid).toBe(false);
});

test("a directory that is not a repository throws", () => {
  expect(() => markerPath("/")).toThrow(/git/);
});
