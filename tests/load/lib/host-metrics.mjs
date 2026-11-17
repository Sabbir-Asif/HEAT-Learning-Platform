export const parseCpuTimes = (statText) => {
  const line = statText.split("\n").find((entry) => entry.startsWith("cpu "));
  if (line === undefined) throw new Error("No aggregate cpu line");
  const fields = line.trim().split(/\s+/).slice(1).map(Number);
  const steal = fields[7] ?? 0;
  return { total: fields.slice(0, 8).reduce((sum, value) => sum + value, 0), steal };
};

export const stealPercent = (before, after) => {
  const total = after.total - before.total;
  if (total <= 0) return 0;
  return ((after.steal - before.steal) / total) * 100;
};

export const parseTransmitBytes = (netDevText, interfaceName) => {
  const line = netDevText
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${interfaceName}:`));
  if (line === undefined) throw new Error(`No interface ${interfaceName}`);
  const fields = line
    .slice(interfaceName.length + 1)
    .trim()
    .split(/\s+/)
    .map(Number);
  return fields[8];
};

export const egressMbps = (beforeBytes, afterBytes, seconds) => {
  if (seconds <= 0) return 0;
  return (Math.max(0, afterBytes - beforeBytes) * 8) / seconds / 1e6;
};

export const parseDiskCounters = (diskstatsText, deviceName) => {
  const line = diskstatsText
    .split("\n")
    .map((entry) => entry.trim().split(/\s+/))
    .find((fields) => fields[2] === deviceName);
  if (line === undefined) throw new Error(`No device ${deviceName}`);
  const numbers = line.slice(3).map(Number);
  return {
    reads: numbers[0],
    readMilliseconds: numbers[3],
    writes: numbers[4],
    writeMilliseconds: numbers[7],
  };
};

export const diskLatencyMilliseconds = (before, after) => {
  const operations = after.reads - before.reads + (after.writes - before.writes);
  if (operations <= 0) return 0;
  const milliseconds =
    after.readMilliseconds -
    before.readMilliseconds +
    (after.writeMilliseconds - before.writeMilliseconds);
  return milliseconds / operations;
};

export const csvHeader = "timestamp,cpu_steal_percent,egress_mbps,disk_latency_ms";

export const csvRow = (timestamp, steal, egress, latency) =>
  [timestamp, steal.toFixed(2), egress.toFixed(2), latency.toFixed(2)].join(",");
