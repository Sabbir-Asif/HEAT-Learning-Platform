import { headOf, isClean, writeMarker } from "./hooks/marker.mjs";

export const steps = [
  ["pnpm", "lint"],
  ["pnpm", "format:check"],
  ["pnpm", "typecheck"],
  ["pnpm", "test:coverage"],
  ["pnpm", "build"],
];

export function runVerify({ cwd, run }) {
  if (!isClean(cwd)) {
    return {
      ok: false,
      reason: "the working tree has uncommitted changes; commit them, then run verify again",
    };
  }
  const head = headOf(cwd);
  for (const step of steps) {
    if (run(step) !== 0) return { ok: false, reason: `${step.join(" ")} failed` };
  }
  if (headOf(cwd) !== head) {
    return { ok: false, reason: "HEAD moved while the checks ran; run verify again" };
  }
  if (!isClean(cwd)) {
    return {
      ok: false,
      reason: "the checks changed the working tree; commit the result and run verify again",
    };
  }
  writeMarker(cwd);
  return { ok: true };
}
