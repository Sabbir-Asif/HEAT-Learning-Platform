import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import hls from "../../../infra/nginx/hls.js";
import { signingInput } from "../../../infra/nginx/hls-verify.js";

const now = 1_800_000_000;
const secrets = { k1: "secret-one-0123456789", k2: "secret-two-0123456789" };

const cookieFor = (videoId, kid, expiry) =>
  `hls_sig=${kid}.${expiry}.${createHmac("sha256", secrets[kid]).update(signingInput(videoId, expiry)).digest("hex")}`;

const requestFor = (uri, cookie) => {
  const logs = [];
  return {
    variables: { request_uri: uri },
    headersIn: cookie === undefined ? {} : { Cookie: cookie },
    warn: (message) => logs.push(message),
    logs,
  };
};

describe("hls.authorize", () => {
  const original = process.env.HLS_SIGNING_KEYS;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now * 1000);
    process.env.HLS_SIGNING_KEYS = `k1:${secrets.k1},k2:${secrets.k2}`;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (original === undefined) delete process.env.HLS_SIGNING_KEYS;
    else process.env.HLS_SIGNING_KEYS = original;
  });

  test("returns 1 for a valid cookie under the right video", () => {
    const request = requestFor("/hls/A/index.m3u8", cookieFor("A", "k1", now + 60));
    expect(hls.authorize(request)).toBe("1");
    expect(request.logs).toEqual([]);
  });

  test("returns 0 and logs only the reason for an expired cookie", () => {
    const request = requestFor("/hls/A/index.m3u8", cookieFor("A", "k1", now - 1));
    expect(hls.authorize(request)).toBe("0");
    expect(request.logs).toEqual(["hls denied: expired"]);
  });

  test("returns 0 for another video, a traversal path and no cookie", () => {
    expect(hls.authorize(requestFor("/hls/B/x.ts", cookieFor("A", "k1", now + 60)))).toBe("0");
    expect(hls.authorize(requestFor("/hls/A/../B/x.ts", cookieFor("A", "k1", now + 60)))).toBe("0");
    expect(hls.authorize(requestFor("/hls/A/x.ts"))).toBe("0");
  });

  test("returns 0 for every request when no key is configured", () => {
    delete process.env.HLS_SIGNING_KEYS;
    expect(hls.authorize(requestFor("/hls/A/x.ts", cookieFor("A", "k1", now + 60)))).toBe("0");
  });

  test("a key removed from the environment is rejected on the next request", () => {
    const cookie = cookieFor("A", "k1", now + 60);
    expect(hls.authorize(requestFor("/hls/A/x.ts", cookie))).toBe("1");
    process.env.HLS_SIGNING_KEYS = `k2:${secrets.k2}`;
    expect(hls.authorize(requestFor("/hls/A/x.ts", cookie))).toBe("0");
  });
});
