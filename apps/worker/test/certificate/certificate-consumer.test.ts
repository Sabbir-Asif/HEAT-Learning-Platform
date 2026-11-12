import { describe, expect, test } from "vitest";
import { isFinalCertificateAttempt } from "../../src/certificate/certificate-consumer";

describe("isFinalCertificateAttempt", () => {
  test("is final on the last allowed attempt", () => {
    expect(isFinalCertificateAttempt(5, 6)).toBe(true);
    expect(isFinalCertificateAttempt(4, 6)).toBe(false);
    expect(isFinalCertificateAttempt(0, undefined)).toBe(true);
  });
});
