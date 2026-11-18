export const SEGMENT_SECONDS = 6;
export const TARGET_AVERAGE_KBPS = 1200;
export const HLS_COOKIE_TTL_SECONDS = 600;
export const COOKIE_REFRESH_MARGIN_SECONDS = 90;

export const RENDITION_KBPS = {
  "360p": 496,
  "480p": 746,
  "720p": 1196,
  "1080p": 2296,
};

export const RENDITION_MIX = [
  { name: "360p", weight: 5 },
  { name: "480p", weight: 25 },
  { name: "720p", weight: 55 },
  { name: "1080p", weight: 15 },
];

export const PROFILES = {
  smoke: { viewers: 10, rampSeconds: 20, holdSeconds: 100, rampDownSeconds: 20 },
  steady: { viewers: 200, rampSeconds: 300, holdSeconds: 1800, rampDownSeconds: 60 },
  headroom: { viewers: 250, rampSeconds: 300, holdSeconds: 1800, rampDownSeconds: 60 },
};

export const averageKbps = (mix, kbps = RENDITION_KBPS) => {
  const total = mix.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) throw new Error("Mix weights must add up to more than zero");
  return mix.reduce((sum, entry) => sum + (entry.weight / total) * kbps[entry.name], 0);
};

export const pickRendition = (mix, roll) => {
  if (!(roll >= 0 && roll < 1)) throw new Error("Roll must be at least 0 and below 1");
  const total = mix.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = roll * total;
  for (const entry of mix) {
    if (threshold < entry.weight) return entry.name;
    threshold -= entry.weight;
  }
  return mix[mix.length - 1].name;
};

export const profileStages = (profile) => [
  { duration: `${profile.rampSeconds}s`, target: profile.viewers },
  { duration: `${profile.holdSeconds}s`, target: profile.viewers },
  { duration: `${profile.rampDownSeconds}s`, target: 0 },
];

export const pacingDelaySeconds = (segmentSeconds, elapsedSeconds) =>
  Math.max(0, segmentSeconds - elapsedSeconds);

export const refreshDue = (
  nowSeconds,
  issuedAtSeconds,
  ttlSeconds = HLS_COOKIE_TTL_SECONDS,
  marginSeconds = COOKIE_REFRESH_MARGIN_SECONDS,
) => nowSeconds - issuedAtSeconds >= ttlSeconds - marginSeconds;

export const peakEgressMbps = (viewers, averageKbpsPerViewer) =>
  (viewers * averageKbpsPerViewer) / 1000;

export const monthlyEgressTerabytes = (averageMbps, viewingHoursPerDay, days = 30) =>
  (averageMbps * 1e6 * 3600 * viewingHoursPerDay * days) / 8 / 1e12;

const lines = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

export const variantUris = (masterText) => {
  const entries = lines(masterText);
  const uris = [];
  entries.forEach((line, index) => {
    if (!line.startsWith("#EXT-X-STREAM-INF")) return;
    const next = entries[index + 1];
    if (next !== undefined && !next.startsWith("#")) uris.push(next);
  });
  return uris;
};

export const variantName = (uri) => uri.split("/")[0];

export const segmentEntries = (playlistText) => {
  const entries = lines(playlistText);
  const segments = [];
  let seconds = SEGMENT_SECONDS;
  for (const line of entries) {
    if (line.startsWith("#EXTINF:")) {
      const parsed = parseFloat(line.slice("#EXTINF:".length));
      seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : SEGMENT_SECONDS;
    } else if (!line.startsWith("#")) {
      segments.push({ uri: line, seconds });
    }
  }
  return segments;
};

export const resolveUri = (baseUrl, uri) => {
  if (/^https?:\/\//.test(uri)) return uri;
  if (uri.startsWith("/")) return baseUrl.replace(/^(https?:\/\/[^/]+).*$/, "$1") + uri;
  return baseUrl.replace(/[^/]*$/, "") + uri;
};
