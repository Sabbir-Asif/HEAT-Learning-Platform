import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { loadCertificateRuntimeConfig } from "../../src/certificate/certificate-runtime-config";

describe("loadCertificateRuntimeConfig", () => {
  test("uses local defaults", () => {
    expect(loadCertificateRuntimeConfig({})).toEqual({
      storageDirectory: resolve("../../.data/certificates"),
      renderTimeoutMs: 60000,
      chromiumExecutablePath: undefined,
    });
  });

  test("reads configured values and treats blanks as unset", () => {
    expect(
      loadCertificateRuntimeConfig({
        CERTIFICATE_STORAGE_DIR: "/srv/certificates",
        CERTIFICATE_RENDER_TIMEOUT_MS: "90000",
        CHROMIUM_EXECUTABLE_PATH: "/usr/bin/chromium",
      }),
    ).toEqual({
      storageDirectory: "/srv/certificates",
      renderTimeoutMs: 90000,
      chromiumExecutablePath: "/usr/bin/chromium",
    });
    expect(
      loadCertificateRuntimeConfig({
        CERTIFICATE_STORAGE_DIR: "",
        CERTIFICATE_RENDER_TIMEOUT_MS: "",
        CHROMIUM_EXECUTABLE_PATH: "",
      }).renderTimeoutMs,
    ).toBe(60000);
  });

  test.each(["abc", "999", "1.5", "700000"])("rejects timeout %s", (value) => {
    expect(() => loadCertificateRuntimeConfig({ CERTIFICATE_RENDER_TIMEOUT_MS: value })).toThrow();
  });
});
