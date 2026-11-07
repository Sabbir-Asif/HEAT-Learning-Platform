#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { parseCli, setup } from "../src/github-setup.mjs";

const gh = (args, input) =>
  execFileSync("gh", args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });

try {
  const { problems } = setup({ gh, ...parseCli(process.argv.slice(2)) });
  if (problems.length) {
    console.error(["Needs a person:", ...problems.map((problem) => `  - ${problem}`)].join("\n"));
    process.exit(1);
  }
} catch (error) {
  console.error(`github:setup failed: ${error.message}`);
  process.exit(1);
}
