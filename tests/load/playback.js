import http from "k6/http";
import exec from "k6/execution";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Rate, Trend } from "k6/metrics";
import {
  PROFILES,
  RENDITION_MIX,
  pacingDelaySeconds,
  pickRendition,
  profileStages,
  refreshDue,
  resolveUri,
  segmentEntries,
  variantName,
  variantUris,
} from "./lib/plan.js";

const baseUrl = (__ENV.BASE_URL || "").replace(/\/$/, "");
const videoId = __ENV.VIDEO_ID || "";
const profileName = __ENV.PROFILE || "smoke";
const profile = PROFILES[profileName];
const controlViewers = Number(__ENV.CONTROL_VIEWERS || 2);
const maxSegmentsPerView = Number(__ENV.MAX_SEGMENTS || 100);

const accounts = new SharedArray("accounts", () => JSON.parse(open(__ENV.ACCOUNTS_FILE)));

const segmentErrors = new Rate("segment_errors");
const segmentLatency = new Trend("segment_latency_ms", true);
const segmentBytes = new Counter("segment_bytes");
const controlForbidden = new Rate("control_forbidden");
const sessionFailures = new Rate("session_failures");

export const options = {
  scenarios: {
    viewers: {
      executor: "ramping-vus",
      exec: "viewer",
      startVUs: 0,
      stages: profileStages(profile),
      gracefulRampDown: "30s",
    },
    control: {
      executor: "constant-vus",
      exec: "control",
      vus: controlViewers,
      duration: `${profile.rampSeconds + profile.holdSeconds}s`,
    },
  },
  thresholds: {
    segment_errors: ["rate<0.01"],
    segment_latency_ms: ["p(95)<1000"],
    control_forbidden: ["rate==1"],
    session_failures: ["rate<0.01"],
  },
};

const csrfCookieName = "__Host-heat_csrf";

const state = { signedIn: false, csrf: "", controlSegmentUrl: "" };

const jsonHeaders = (csrf) => ({
  "Content-Type": "application/json",
  "x-csrf-token": csrf,
});

const signIn = (account) => {
  const response = http.post(
    `${baseUrl}/api/auth/sign-in`,
    JSON.stringify({ email: account.email, password: account.password }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "sign-in" } },
  );
  const cookies = http.cookieJar().cookiesForURL(`${baseUrl}/`);
  const issued = cookies[csrfCookieName];
  state.csrf = issued !== undefined && issued.length > 0 ? issued[0] : "";
  state.signedIn = response.status === 200 && state.csrf !== "";
  return state.signedIn;
};

const startSession = (suffix) => {
  const response = http.post(`${baseUrl}/api/videos/${videoId}/playback-session${suffix}`, null, {
    headers: jsonHeaders(state.csrf),
    tags: { name: "playback-session" },
  });
  const ok = check(response, { "playback session granted": (r) => r.status === 200 });
  sessionFailures.add(!ok);
  return ok ? response.json("manifestPath") : null;
};

const fetchText = (url, name) => {
  const response = http.get(url, { tags: { name } });
  return response.status === 200 ? response.body : null;
};

const fetchSegment = (url) => {
  const response = http.get(url, { tags: { name: "segment" }, responseType: "binary" });
  const ok = response.status === 200;
  segmentErrors.add(!ok);
  if (ok) {
    segmentLatency.add(response.timings.duration);
    segmentBytes.add(response.body.byteLength);
  }
  return response.timings.duration / 1000;
};

export function viewer() {
  const account = accounts[(exec.vu.idInTest - 1) % accounts.length];
  if (!state.signedIn && !signIn(account)) {
    sessionFailures.add(true);
    sleep(10);
    return;
  }
  const manifestPath = startSession("");
  if (manifestPath === null) {
    sleep(10);
    return;
  }
  let issuedAt = Date.now() / 1000;
  const masterUrl = `${baseUrl}${manifestPath}`;
  const master = fetchText(masterUrl, "master-playlist");
  if (master === null) {
    segmentErrors.add(true);
    return;
  }
  const uris = variantUris(master);
  const wanted = pickRendition(RENDITION_MIX, Math.random());
  const chosen = uris.find((uri) => variantName(uri) === wanted) || uris[uris.length - 1];
  const playlistUrl = resolveUri(masterUrl, chosen);
  const playlist = fetchText(playlistUrl, "rendition-playlist");
  if (playlist === null) {
    segmentErrors.add(true);
    return;
  }
  for (const segment of segmentEntries(playlist).slice(0, maxSegmentsPerView)) {
    if (refreshDue(Date.now() / 1000, issuedAt)) {
      startSession("/refresh");
      issuedAt = Date.now() / 1000;
    }
    const elapsed = fetchSegment(resolveUri(playlistUrl, segment.uri));
    sleep(pacingDelaySeconds(segment.seconds, elapsed));
  }
}

const discoverControlSegment = () => {
  const account = accounts[accounts.length - 1];
  if (!state.signedIn && !signIn(account)) return false;
  const manifestPath = startSession("");
  if (manifestPath === null) return false;
  const masterUrl = `${baseUrl}${manifestPath}`;
  const master = fetchText(masterUrl, "master-playlist");
  if (master === null) return false;
  const uris = variantUris(master);
  if (uris.length === 0) return false;
  const playlistUrl = resolveUri(masterUrl, uris[0]);
  const playlist = fetchText(playlistUrl, "rendition-playlist");
  if (playlist === null) return false;
  const segments = segmentEntries(playlist);
  if (segments.length === 0) return false;
  state.controlSegmentUrl = resolveUri(playlistUrl, segments[0].uri);
  return true;
};

export function control() {
  if (state.controlSegmentUrl === "" && !discoverControlSegment()) {
    sessionFailures.add(true);
    sleep(10);
    return;
  }
  const response = http.get(state.controlSegmentUrl, {
    tags: { name: "control-segment" },
    jar: new http.CookieJar(),
  });
  controlForbidden.add(response.status === 403);
  sleep(1);
}
