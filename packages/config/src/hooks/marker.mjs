import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.mjs";

const markerName = "heat-verified";

function required(top, args) {
  const value = git(top, args);
  if (value === null) throw new Error(`git ${args.join(" ")} failed in ${top}`);
  return value;
}

export const markerPath = (top) =>
  join(required(top, ["rev-parse", "--absolute-git-dir"]), markerName);

export const headOf = (top) => required(top, ["rev-parse", "HEAD"]);

export const isClean = (top) => required(top, ["status", "--porcelain"]) === "";

export function writeMarker(top) {
  writeFileSync(markerPath(top), `${headOf(top)}\n`);
}

function readMarker(top) {
  try {
    return readFileSync(markerPath(top), "utf8").trim();
  } catch {
    return null;
  }
}

export function markerStatus(top) {
  const stored = readMarker(top);
  if (stored === null) {
    return { valid: false, reason: "no verification marker exists; run pnpm verify first" };
  }
  if (stored !== headOf(top)) {
    return {
      valid: false,
      reason: "the verification marker is for an older commit; run pnpm verify again",
    };
  }
  if (!isClean(top)) {
    return {
      valid: false,
      reason:
        "there are uncommitted changes since the verification; commit them and run pnpm verify again",
    };
  }
  return { valid: true };
}
