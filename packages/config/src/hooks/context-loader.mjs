import { today } from "../ticket.mjs";
import { branchOf, repoOf, ticketNumber, worktreesOf } from "./git.mjs";

const maxListed = 5;

function ticketWorktrees(top) {
  return worktreesOf(top)
    .filter((tree) => ticketNumber(tree.branch ?? "") !== null)
    .slice(0, maxListed)
    .map((tree) => `- ${tree.branch} at ${tree.path}`);
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
  return {
    context: [header, `Branch: ${branch}`, `Ticket: #${number}`].join("\n"),
  };
}
