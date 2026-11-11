import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  keyframesAligned,
  parseMediaPlaylistDurations,
  parseTimes,
  segmentsAboutSixSeconds,
} from "../dist/transcode/ladder-verify.js";

const [outputArg] = process.argv.slice(2);
if (!outputArg) {
  console.error("usage: verify-ladder.mjs <outputDir>");
  process.exit(2);
}
const outputDir = resolve(outputArg);

const probe = (args) => {
  const run = spawnSync("ffprobe", ["-v", "error", ...args], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout;
};

const master = readFileSync(resolve(outputDir, "master.m3u8"), "utf8");
const playlists = [...master.matchAll(/^(\S+\/index\.m3u8)$/gm)].map((m) => m[1]);
const failures = [];
let reference;

for (const playlist of playlists) {
  const name = playlist.split("/")[0];
  const path = resolve(outputDir, playlist);

  const keyframes = parseTimes(
    probe([
      "-select_streams",
      "v:0",
      "-skip_frame",
      "nokey",
      "-show_entries",
      "frame=pts_time",
      "-of",
      "csv=p=0",
      path,
    ]),
  );
  reference ??= keyframes;
  if (!keyframesAligned(reference, keyframes))
    failures.push(`${name}: keyframes differ from ${playlists[0]}`);

  const durations = parseMediaPlaylistDurations(readFileSync(path, "utf8"));
  if (!segmentsAboutSixSeconds(durations))
    failures.push(`${name}: segments are not about 6 seconds`);

  const codecs = probe(["-show_entries", "stream=codec_name", "-of", "csv=p=0", path])
    .split("\n")
    .filter(Boolean)
    .sort()
    .join(",");
  if (codecs !== "aac,h264") failures.push(`${name}: codecs are ${codecs}`);

  console.log(
    `${name}: ${keyframes.length} keyframes, ${durations.length} segments, codecs ${codecs}`,
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`ok: ${playlists.length} renditions aligned`);
