import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { today } from "../ticket.mjs";
import { branchOf, repoOf, ticketNumber, worktreesOf } from "./git.mjs";

const maxListed = 5;

function planProgress(top, number) {
  const path = join(top, "docs", "plans", `issue-${number}.md`);
  if (!existsSync(path)) return { path: `docs/plans/issue-${number}.md`, summary: "missing" };
  const boxes = [...readFileSync(path, "utf8").matchAll(/^\s*- \[([ xX])\]/gm)];
  const ticked = boxes.filter((box) => box[1] !== " ").length;
  return {
    path: `docs/plans/issue-${number}.md`,
    summary: `exists, ${ticked} of ${boxes.length} tasks ticked`,
  };
}

function ticketWorktrees(top) {
  return worktreesOf(top)
    .filter((tree) => ticketNumber(tree.branch ?? "") !== null)
    .slice(0, maxListed)
    .map((tree) => {
      const progress = planProgress(tree.path, ticketNumber(tree.branch));
      return `- ${tree.branch} at ${tree.path} (plan ${progress.summary})`;
    });
}

export function contextLoader(input) {
  const header = `HEAT LMS workflow context (${today()}, Asia/Dhaka)`;
  const top = repoOf(input.cwd || process.cwd());
  if (!top) return { context: `${header}\nNot in a git repository.` };
  const branch = branchOf(top);
  const number = ticketNumber(branch);
  if (number === null) {
    const lines = [
      header,
      `Branch: ${branch || "detached HEAD"}`,
      "No ticket branch. Start a ticket with /implement-issue <N>; edits on main are blocked.",
    ];
    const open = ticketWorktrees(top);
    if (open.length) lines.push("Ticket worktrees to resume:", ...open);
    return { context: lines.join("\n") };
  }
  const plan = planProgress(top, number);
  return {
    context: [
      header,
      `Branch: ${branch}`,
      `Ticket: #${number}`,
      `Plan: ${plan.path} (${plan.summary})`,
      "Before implementing, check the issue for the plan approval comment when the ticket is size L or labelled security.",
    ].join("\n"),
  };
}
