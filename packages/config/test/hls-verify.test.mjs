import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import verify from "../../../infra/nginx/hls-verify.js";

const { constantTimeEqual, normalisePath, parseKeys, signingInput, verifyRequest } = verify;

const hmacHex = (secret, data) => createHmac("sha256", secret).update(data).digest("hex");
const now = 1_800_000_000;
const keys = { k1: "secret-one-0123456789", k2: "secret-two-0123456789" };

const cookieFor = (videoId, { kid = "k1", expiry = now + 600, secret = keys[kid] } = {}) =>
  `hls_sig=${kid}.${expiry}.${hmacHex(secret, signingInput(videoId, expiry))}`;

const check = (uri, cookie, overrides = {}) =>
  verifyRequest({ uri, cookieHeader: cookie, keys, now, hmacHex, ...overrides });

describe("shared test vector with the API signer", () => {
  test("the API test pins the same signature for this input", () => {
    expect(signingInput("abc_1", 1800000600)).toBe("abc_1\n/hls/abc_1/\n1800000600");
    expect(hmacHex("secret-one-0123456789", signingInput("abc_1", 1800000600))).toBe(
      "64e3c18a34b0cbe6cf0f767661fa0e0c77ee902f5690f714768b497619ef147b",
    );
  });
});

describe("normalisePath", () => {
  test("returns a clean path unchanged and drops the query string", () => {
    expect(normalisePath("/hls/abc/index.m3u8?x=1")).toBe("/hls/abc/index.m3u8");
    expect(normalisePath("/hls/abc/")).toBe("/hls/abc/");
  });

  test("decodes one level of percent-encoding for ordinary characters", () => {
    expect(normalisePath("/hls/abc/seg%5F1.ts")).toBe("/hls/abc/seg_1.ts");
  });

  test.each([
    "/hls/A/../B/x.ts",
    "/hls/A/./x.ts",
    "/hls/A/%2e%2e/B/x.ts",
    "/hls/A/%2E%2E/B/x.ts",
    "/hls/A/.%2e/B/x.ts",
    "/hls/A/..%2fB/x.ts",
    "/hls/A/..%2FB/x.ts",
    "/hls/A%2f..%2fB/x.ts",
    "/hls/A/%252e%252e/B/x.ts",
    "/hls/A/%252fx.ts",
    "/hls/A/..\\B/x.ts",
    "/hls/A/%5cB/x.ts",
    "/hls/A/x.ts%00.jpg",
    "/hls/A/x.ts\u0000",
    "/hls//A/x.ts",
    "/hls/A//x.ts",
    "/hls/A/%zz.ts",
    "/hls/A/%2",
    "/hls/A/%ff.ts",
    "hls/A/x.ts",
    "",
  ])("rejects %j", (uri) => {
    expect(normalisePath(uri)).toBeNull();
  });
});

describe("constantTimeEqual", () => {
  test("is true only for identical strings", () => {
    expect(constantTimeEqual("abcdef", "abcdef")).toBe(true);
    expect(constantTimeEqual("abcdef", "abcdeg")).toBe(false);
    expect(constantTimeEqual("abcdef", "abcde")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
    expect(constantTimeEqual("", "a")).toBe(false);
  });
});

describe("parseKeys", () => {
  test("reads id:secret pairs separated by commas", () => {
    expect(parseKeys("k1:aaa,k2:bbb")).toEqual({ k1: "aaa", k2: "bbb" });
  });

  test("ignores blanks and malformed entries", () => {
    expect(parseKeys(" k1:aaa , ,nocolon,:empty,bad id:x")).toEqual({ k1: "aaa" });
    expect(parseKeys(undefined)).toEqual({});
    expect(parseKeys("")).toEqual({});
  });
});

describe("verifyRequest", () => {
  test("accepts a valid cookie for the requested video", () => {
    expect(check("/hls/A/index.m3u8", cookieFor("A"))).toEqual({
      ok: true,
      videoId: "A",
      keyId: "k1",
    });
    expect(check("/hls/A/720p/segment_00001.ts", cookieFor("A")).ok).toBe(true);
  });

  test("finds the cookie among others", () => {
    const cookie = `theme=dark; ${cookieFor("A")}; other=1`;
    expect(check("/hls/A/index.m3u8", cookie).ok).toBe(true);
  });

  test("rejects an expired cookie, including at the exact expiry second", () => {
    expect(check("/hls/A/x.ts", cookieFor("A", { expiry: now - 1 }))).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(check("/hls/A/x.ts", cookieFor("A", { expiry: now })).reason).toBe("expired");
    expect(check("/hls/A/x.ts", cookieFor("A", { expiry: now + 1 })).ok).toBe(true);
  });

  test("rejects a signature with any one character changed", () => {
    const cookie = cookieFor("A");
    for (let index = cookie.length - 64; index < cookie.length; index++) {
      const flipped = cookie[index] === "0" ? "1" : "0";
      const tampered = cookie.slice(0, index) + flipped + cookie.slice(index + 1);
      expect(check("/hls/A/x.ts", tampered)).toEqual({ ok: false, reason: "bad-signature" });
    }
  });

  test("rejects a changed expiry because it is part of the signed input", () => {
    const cookie = cookieFor("A").replace(`${now + 600}`, `${now + 6000}`);
    expect(check("/hls/A/x.ts", cookie).reason).toBe("bad-signature");
  });

  test("rejects a cookie issued for another video", () => {
    expect(check("/hls/B/x.ts", cookieFor("A"))).toEqual({ ok: false, reason: "bad-signature" });
  });

  test.each([
    "/hls/A/../B/x.ts",
    "/hls/A/%2e%2e/B/x.ts",
    "/hls/A%2f..%2fB/x.ts",
    "/hls/A/%252e%252e/B/x.ts",
    "/hls/A/..\\B/x.ts",
    "/hls/A/x.ts%00",
  ])("rejects the traversal variant %s even with a valid cookie for A", (uri) => {
    expect(check(uri, cookieFor("A"))).toEqual({ ok: false, reason: "bad-path" });
  });

  test("rejects paths outside /hls/<videoId>/", () => {
    expect(check("/media/originals/A.mp4", cookieFor("A")).reason).toBe("bad-path");
    expect(check("/hls/", cookieFor("A")).reason).toBe("bad-path");
    expect(check("/hls/A", cookieFor("A")).reason).toBe("bad-path");
    expect(check("/hls/a b/x.ts", cookieFor("A")).reason).toBe("bad-path");
  });

  test("rejects a missing cookie header and a cookie header without hls_sig", () => {
    expect(check("/hls/A/x.ts", undefined).reason).toBe("no-cookie");
    expect(check("/hls/A/x.ts", "").reason).toBe("no-cookie");
    expect(check("/hls/A/x.ts", "session=abc").reason).toBe("no-cookie");
  });

  test("rejects a duplicated hls_sig cookie", () => {
    const cookie = `${cookieFor("A")}; ${cookieFor("A")}`;
    expect(check("/hls/A/x.ts", cookie).reason).toBe("malformed");
  });

  test.each([
    "hls_sig=",
    "hls_sig=garbage",
    "hls_sig=k1.123",
    "hls_sig=k1.abc.ff",
    `hls_sig=k1.${now + 600}.${"z".repeat(64)}`,
    `hls_sig=k1.${now + 600}.${"a".repeat(63)}`,
    `hls_sig=k1.${now + 600}.${"A".repeat(64)}`,
    `hls_sig=k1.${now + 600}.${"a".repeat(64)}.extra`,
    `hls_sig=.${now + 600}.${"a".repeat(64)}`,
    `hls_sig=k1.-5.${"a".repeat(64)}`,
    `hls_sig=k1.99999999999.${"a".repeat(64)}`,
  ])("rejects the malformed cookie %s", (cookie) => {
    expect(check("/hls/A/x.ts", cookie)).toEqual({ ok: false, reason: "malformed" });
  });

  test("rejects an unknown key id", () => {
    const cookie = cookieFor("A", { kid: "k9", secret: "whatever-secret-value" });
    expect(check("/hls/A/x.ts", cookie)).toEqual({ ok: false, reason: "unknown-key" });
  });

  test("rejects a signature made with a different secret under a known key id", () => {
    const cookie = cookieFor("A", { kid: "k1", secret: "not-the-real-secret" });
    expect(check("/hls/A/x.ts", cookie).reason).toBe("bad-signature");
  });

  test("accepts the previous key while it is active and rejects it after retirement", () => {
    const previous = cookieFor("A", { kid: "k1" });
    const current = cookieFor("A", { kid: "k2" });

    expect(check("/hls/A/x.ts", previous).ok).toBe(true);
    expect(check("/hls/A/x.ts", current).ok).toBe(true);

    const retired = { k2: keys.k2 };
    expect(check("/hls/A/x.ts", previous, { keys: retired })).toEqual({
      ok: false,
      reason: "unknown-key",
    });
    expect(check("/hls/A/x.ts", current, { keys: retired }).ok).toBe(true);
  });

  test("rejects everything when no key is configured", () => {
    expect(check("/hls/A/x.ts", cookieFor("A"), { keys: {} }).reason).toBe("unknown-key");
  });

  test("does not treat inherited object properties as key ids", () => {
    const cookie = `hls_sig=constructor.${now + 600}.${"a".repeat(64)}`;
    expect(check("/hls/A/x.ts", cookie).reason).toBe("unknown-key");
  });
});
