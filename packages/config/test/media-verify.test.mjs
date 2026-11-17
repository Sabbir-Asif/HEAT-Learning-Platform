import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import verify from "../../../infra/nginx/media-verify.js";

const { signingInput, verifyRequest } = verify;

const hmacHex = (secret, data) => createHmac("sha256", secret).update(data).digest("hex");
const now = 1_800_000_000;
const keys = { k1: "secret-one-0123456789", k2: "secret-two-0123456789" };
const path = "/media/protected/2026/11/0194f3a0-0000-7000-8000-0000000000aa/w640.webp";

const signedUri = (target, { kid = "k1", expiry = now + 3600, secret = keys[kid] } = {}) =>
  `${target}?k=${kid}&e=${expiry}&s=${hmacHex(secret, signingInput(path, expiry))}`;

const check = (uri) => verifyRequest({ uri, keys, now, hmacHex });

describe("protected media signed links", () => {
  test("pins the signing input shared with the API signer", () => {
    expect(signingInput("/media/protected/a", 5)).toBe("/media/protected/a\n5");
  });

  test("accepts a fresh signature for the exact path", () => {
    expect(check(signedUri(path))).toEqual({ ok: true, keyId: "k1" });
  });

  test("accepts a rotated key that is still configured", () => {
    expect(check(signedUri(path, { kid: "k2" })).ok).toBe(true);
  });

  test("rejects a link used after it expired", () => {
    expect(check(signedUri(path, { expiry: now - 1 }))).toEqual({ ok: false, reason: "expired" });
  });

  test("rejects a link whose path was changed", () => {
    const other = path.replace("w640", "w320");
    expect(check(signedUri(path).replace(path, other))).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  test("rejects traversal and encoded separators", () => {
    expect(check(signedUri("/media/protected/2026/11/../../x"))).toEqual({
      ok: false,
      reason: "bad-path",
    });
    expect(check(signedUri(path.replace("/w640", "%2Fw640"))).ok).toBe(false);
  });

  test("rejects an unknown key, a forged signature and missing or duplicated parameters", () => {
    expect(check(signedUri(path, { kid: "k9", secret: "x" })).reason).toBe("unknown-key");
    expect(check(signedUri(path, { secret: "wrong-secret-0123456789" })).reason).toBe(
      "bad-signature",
    );
    expect(check(path).reason).toBe("malformed");
    expect(check(`${signedUri(path)}&s=${"0".repeat(64)}`).reason).toBe("malformed");
  });

  test("only the protected media path is served", () => {
    expect(check(signedUri("/media/public/2026/11/x/w640.webp")).reason).toBe("bad-path");
  });
});
