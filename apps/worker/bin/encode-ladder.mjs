import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildMasterPlaylist,
  buildRenditionArgs,
  selectRenditions,
} from "../dist/transcode/ladder.js";

const MAX_FPS = 30;
const [input, outputArg] = process.argv.slice(2);
if (!input || !outputArg) {
  console.error("usage: encode-ladder.mjs <input> <outputDir>");
  process.exit(2);
}
const outputDir = resolve(outputArg);

const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=height,r_frame_rate",
    "-of",
    "json",
    input,
  ],
  { encoding: "utf8" },
);
if (probe.status !== 0) {
  console.error(probe.stderr);
  process.exit(1);
}
const stream = JSON.parse(probe.stdout).streams[0];
const [numerator, denominator] = stream.r_frame_rate.split("/").map(Number);
const fps = Math.min(numerator / denominator, MAX_FPS);
const renditions = selectRenditions(stream.height);

const directorySize = (directory) =>
  readdirSync(directory).reduce((sum, file) => sum + statSync(resolve(directory, file)).size, 0);

for (const rendition of renditions) {
  mkdirSync(resolve(outputDir, rendition.name), { recursive: true });
  const started = process.hrtime.bigint();
  const run = spawnSync(
    "nice",
    ["-n", "19", "ffmpeg", ...buildRenditionArgs(rendition, { input, outputDir, fps })],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  if (run.status !== 0) process.exit(run.status ?? 1);
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const megabytes = directorySize(resolve(outputDir, rendition.name)) / 1e6;
  console.log(
    `${rendition.name} wall_seconds=${seconds.toFixed(1)} size_mb=${megabytes.toFixed(1)}`,
  );
}

writeFileSync(resolve(outputDir, "master.m3u8"), buildMasterPlaylist(renditions));
console.log(`master.m3u8 lists ${renditions.map((r) => r.name).join(", ")}`);
