import { describe, expect, test } from "vitest";
import {
  certificateNumberAlphabet,
  certificateNumberPattern,
  generateCertificateNumber,
} from "../../src/certificate/certificate-number";

describe("generateCertificateNumber", () => {
  test("produces three groups of four unambiguous characters", () => {
    expect(generateCertificateNumber()).toMatch(certificateNumberPattern);
  });

  test("never uses ambiguous characters", () => {
    expect(certificateNumberAlphabet).not.toMatch(/[ILOU]/);
    expect(certificateNumberAlphabet).toHaveLength(32);
  });

  test("generates 10000 unique numbers", () => {
    const numbers = new Set(Array.from({ length: 10_000 }, () => generateCertificateNumber()));
    expect(numbers.size).toBe(10_000);
  });

  test("shows no sequence between consecutive numbers", () => {
    const numbers = Array.from({ length: 1000 }, () => generateCertificateNumber());
    const ascending = numbers.filter((number, index) => index > 0 && number > numbers[index - 1]!);
    expect(ascending.length).toBeGreaterThan(400);
    expect(ascending.length).toBeLessThan(600);
  });

  test("spreads characters evenly across the alphabet", () => {
    const counts = new Map<string, number>();
    for (let index = 0; index < 2000; index += 1) {
      for (const character of generateCertificateNumber().replaceAll("-", "")) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(32);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(550);
      expect(count).toBeLessThan(950);
    }
  });

  test("is built only from the supplied random bytes", () => {
    const bytes = Uint8Array.from({ length: 12 }, (_, index) => index);
    expect(generateCertificateNumber(() => bytes)).toBe("0123-4567-89AB");
  });
});
