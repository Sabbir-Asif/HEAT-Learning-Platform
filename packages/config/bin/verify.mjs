#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { runVerify } from "../src/verify.mjs";
import { git } from "../src/hooks/git.mjs";

const top = git(process.cwd(), ["rev-parse", "--show-toplevel"]);

if (!top) {
  console.error("verify failed: run it inside a git repository");
  process.exitCode = 1;
} else {
  const run = ([command, ...args]) => {
    console.log(`\n$ ${[command, ...args].join(" ")}`);
    return spawnSync(command, args, { cwd: top, stdio: "inherit" }).status ?? 1;
  };
  const result = runVerify({ cwd: top, run });
  if (result.ok) console.log("\nverified: the marker for this commit is written");
  else {
    console.error(`\nverify failed: ${result.reason}`);
    process.exitCode = 1;
  }
}
