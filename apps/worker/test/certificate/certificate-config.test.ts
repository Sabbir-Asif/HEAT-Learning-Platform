import { describe, expect, test } from "vitest";
import {
  certificateConfigKeys,
  loadCertificateConfig,
} from "../../src/certificate/certificate-config";

describe("certificate configuration", () => {
  test("declares every key", () => {
    expect([...certificateConfigKeys]).toEqual([
      "PUBLIC_APP_URL",
      "CERTIFICATE_TITLE",
      "CERTIFICATE_INTRO",
      "CERTIFICATE_COMPLETION",
      "CERTIFICATE_VERIFY_LABEL",
      "CERTIFICATE_ORGANISATION_NAME",
      "CERTIFICATE_ORGANISATION_ADDRESS",
      "CERTIFICATE_SIGNATORY_ONE_NAME",
      "CERTIFICATE_SIGNATORY_ONE_TITLE",
      "CERTIFICATE_SIGNATORY_TWO_NAME",
      "CERTIFICATE_SIGNATORY_TWO_TITLE",
    ]);
  });

  test("falls back to placeholder wording for an empty environment", () => {
    const config = loadCertificateConfig({});
    expect(config.verifyBaseUrl).toBe("http://localhost:3000");
    expect(config.wording.title).toBe("Certificate of Completion");
    expect(config.signatories).toHaveLength(2);
    expect(config.organisation.name).not.toBe("");
  });

  test("treats blank values as unset", () => {
    expect(loadCertificateConfig({ CERTIFICATE_TITLE: "" }).wording.title).toBe(
      "Certificate of Completion",
    );
  });

  test("overrides wording and signatories from the environment", () => {
    const config = loadCertificateConfig({
      PUBLIC_APP_URL: "https://learn.example.org",
      CERTIFICATE_TITLE: "Award",
      CERTIFICATE_SIGNATORY_ONE_NAME: "Dr A",
      CERTIFICATE_SIGNATORY_TWO_TITLE: "Registrar",
    });
    expect(config.verifyBaseUrl).toBe("https://learn.example.org");
    expect(config.wording.title).toBe("Award");
    expect(config.signatories[0].name).toBe("Dr A");
    expect(config.signatories[1].title).toBe("Registrar");
  });

  test.each(["not a url", "ftp://learn.example.org", "https://learn.example.org/path"])(
    "rejects the base URL %s",
    (value) => {
      expect(() => loadCertificateConfig({ PUBLIC_APP_URL: value })).toThrow();
    },
  );
});
