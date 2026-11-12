import { describe, expect, test } from "vitest";
import { hlsSigningInput, hlsSignature, issueHlsCookieValue } from "../../src/playback/hls-cookie";

describe("hls cookie", () => {
  test("signing input binds the video id, the path prefix and the expiry", () => {
    expect(hlsSigningInput("abc_1", 1800000600)).toBe("abc_1\n/hls/abc_1/\n1800000600");
  });

  test("signature matches the vector the njs verifier tests use", () => {
    expect(hlsSignature("secret-one-0123456789", "abc_1", 1800000600)).toBe(
      "64e3c18a34b0cbe6cf0f767661fa0e0c77ee902f5690f714768b497619ef147b",
    );
  });

  test("the cookie value is key id, expiry and signature joined by dots", () => {
    const value = issueHlsCookieValue("k1", "secret-one-0123456789", "abc_1", 1800000600);
    expect(value).toBe(
      "k1.1800000600.64e3c18a34b0cbe6cf0f767661fa0e0c77ee902f5690f714768b497619ef147b",
    );
  });
});
