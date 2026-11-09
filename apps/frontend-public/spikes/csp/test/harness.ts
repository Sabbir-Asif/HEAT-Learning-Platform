import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";

const spikeRoot = join(import.meta.dirname, "..");
const nextBin = join(spikeRoot, "../../node_modules/.bin/next");

export type Mode = "partial" | "dynamic";

export interface RunningServer {
  origin: string;
  stop: () => void;
}

export function build(mode: Mode): string {
  return execFileSync(nextBin, ["build"], {
    cwd: spikeRoot,
    env: { ...process.env, SPIKE_MODE: mode, NODE_ENV: "production" },
    encoding: "utf8",
  });
}

export async function start(mode: Mode, port: number, enforce: boolean): Promise<RunningServer> {
  const child: ChildProcess = spawn(nextBin, ["start", "-p", String(port)], {
    cwd: spikeRoot,
    env: { ...process.env, SPIKE_MODE: mode, SPIKE_ENFORCE: enforce ? "1" : "0" },
    stdio: "ignore",
  });
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`${origin}/csp-report`);
      return { origin, stop: () => child.kill() };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  child.kill();
  throw new Error("spike server did not start");
}

export function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1] ?? "",
  );
}

export function scriptsWithoutNonce(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\snonce=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => match[0],
  );
}

export function hashOf(source: string): string {
  return `sha256-${createHash("sha256").update(source).digest("base64")}`;
}

export function nonceOf(policy: string): string {
  return /'nonce-([^']+)'/.exec(policy)?.[1] ?? "";
}

export function scriptSrc(policy: string): string {
  return policy.split("; ").find((directive) => directive.startsWith("script-src")) ?? "";
}
