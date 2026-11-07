#!/usr/bin/env node
// pnpm ticket load <N> | refine <N> --file <path> [--summary <text>] | move <N> start|review
// The GitHub side of the /implement-issue skill. Needs `gh` signed in with the repo and project
// scopes. `load` exits 3 when the ticket may not start; see src/ticket.mjs for the rules.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { appendRefinement, loadTicket, moveCard, parseCli } from "../src/ticket.mjs";

const run = (command) => (args, input) =>
  execFileSync(command, args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
const gh = run("gh");
const git = run("git");

try {
  const cli = parseCli(process.argv.slice(2));
  const { repo, number } = cli;
  if (cli.command === "load") {
    const localBranches = git(["for-each-ref", "--format=%(refname:short)", "refs/heads"])
      .split("\n")
      .filter(Boolean);
    const ticket = loadTicket({ gh, repo, number, localBranches });
    console.log(JSON.stringify(ticket, null, 2));
    process.exitCode = ticket.refusals.length ? 3 : 0;
  } else if (cli.command === "refine") {
    const text = readFileSync(cli.file, "utf8");
    appendRefinement({ gh, repo, number, text, summary: cli.summary });
    console.log(`Appended the refinement to #${number} and logged it.`);
  } else {
    moveCard({ gh, repo, number, stage: cli.stage });
    console.log(`Moved #${number} to ${cli.stage === "start" ? "In progress" : "In review"}.`);
  }
} catch (error) {
  console.error(`ticket failed: ${error.message}`);
  process.exitCode = 1;
}
