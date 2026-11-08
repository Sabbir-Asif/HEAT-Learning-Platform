import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

const removed = [
  ["ban", "gla(?!desh)"],
  ["ben", "gali"],
  ["next", "-intl"],
  ["\\[loc", "ale\\]"],
  ["@heat/", "i18n"],
  ["noto-sans-", "ben", "gali"],
  ["hind ", "siliguri"],
  ["বা", "ংলা"],
].map((parts) => parts.join(""));

const pattern = new RegExp(removed.join("|"), "i");

const exempt = [
  /^docs\/adr\//,
  /^docs\/plans\//,
  /\.(png|jpe?g|gif|ico|woff2?|fig)$/,
];

const tracked = () =>
  execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((file) => file && !exempt.some((rule) => rule.test(file)));

test("the repository is English only, with no trace of the removed language support", () => {
  const offenders = tracked().filter((file) => {
    try {
      return pattern.test(readFileSync(resolve(root, file), "utf8"));
    } catch {
      return false;
    }
  });
  expect(offenders).toEqual([]);
});
