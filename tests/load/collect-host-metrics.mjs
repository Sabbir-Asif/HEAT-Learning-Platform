import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import {
  csvHeader,
  csvRow,
  diskLatencyMilliseconds,
  egressMbps,
  parseCpuTimes,
  parseDiskCounters,
  parseTransmitBytes,
  stealPercent,
} from "./lib/host-metrics.mjs";

const [outputPath, interfaceName, deviceName, minutesText] = process.argv.slice(2);
const intervalSeconds = 60;
const minutes = Number(minutesText);

if (!outputPath || !interfaceName || !deviceName || !(minutes > 0)) {
  console.error(
    "usage: node collect-host-metrics.mjs <out.csv> <interface> <disk device> <minutes>",
  );
  process.exit(2);
}

const snapshot = () => ({
  cpu: parseCpuTimes(readFileSync("/proc/stat", "utf8")),
  bytes: parseTransmitBytes(readFileSync("/proc/net/dev", "utf8"), interfaceName),
  disk: parseDiskCounters(readFileSync("/proc/diskstats", "utf8"), deviceName),
  at: Date.now(),
});

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

writeFileSync(outputPath, `${csvHeader}\n`);
let before = snapshot();
for (let minute = 0; minute < minutes; minute++) {
  await pause(intervalSeconds * 1000);
  const after = snapshot();
  const seconds = (after.at - before.at) / 1000;
  appendFileSync(
    outputPath,
    `${csvRow(
      new Date(after.at).toISOString(),
      stealPercent(before.cpu, after.cpu),
      egressMbps(before.bytes, after.bytes, seconds),
      diskLatencyMilliseconds(before.disk, after.disk),
    )}\n`,
  );
  before = after;
}
