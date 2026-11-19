import { describe, expect, test } from "vitest";
import { normaliseCertificateNumber } from "../../src/verify/certificate-number";

describe("normaliseCertificateNumber", () => {
  test("accepts a number with or without dashes, spaces and lower case", () => {
    expect(normaliseCertificateNumber("0a80-gt3k-11w3")).toBe("0A80-GT3K-11W3");
    expect(normaliseCertificateNumber(" 0A80 GT3K 11W3 ")).toBe("0A80-GT3K-11W3");
    expect(normaliseCertificateNumber("0A80GT3K11W3")).toBe("0A80-GT3K-11W3");
  });

  test("rejects anything that is not 12 letters or digits", () => {
    expect(normaliseCertificateNumber("")).toBeNull();
    expect(normaliseCertificateNumber("0A80-GT3K")).toBeNull();
    expect(normaliseCertificateNumber("0A80-GT3K-11W3-X")).toBeNull();
    expect(normaliseCertificateNumber("0A80-GT3K-11W!")).toBeNull();
  });
});
