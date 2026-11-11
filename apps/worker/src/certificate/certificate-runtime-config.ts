import { resolve } from "node:path";
import { z } from "zod";

const localCertificateDirectory = "../../.data/certificates";

const runtimeSchema = z.object({
  CERTIFICATE_STORAGE_DIR: z.string().trim().min(1).optional(),
  CERTIFICATE_RENDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(60000),
  CHROMIUM_EXECUTABLE_PATH: z.string().trim().min(1).optional(),
});

export interface CertificateRuntimeConfig {
  storageDirectory: string;
  renderTimeoutMs: number;
  chromiumExecutablePath: string | undefined;
}

const blankAsUndefined = (value: string | undefined): string | undefined =>
  value === "" ? undefined : value;

export const loadCertificateRuntimeConfig = (
  env: Partial<Record<string, string | undefined>>,
): CertificateRuntimeConfig => {
  const parsed = runtimeSchema.parse({
    CERTIFICATE_STORAGE_DIR: blankAsUndefined(env["CERTIFICATE_STORAGE_DIR"]),
    CERTIFICATE_RENDER_TIMEOUT_MS: blankAsUndefined(env["CERTIFICATE_RENDER_TIMEOUT_MS"]),
    CHROMIUM_EXECUTABLE_PATH: blankAsUndefined(env["CHROMIUM_EXECUTABLE_PATH"]),
  });
  return {
    storageDirectory: resolve(parsed.CERTIFICATE_STORAGE_DIR ?? localCertificateDirectory),
    renderTimeoutMs: parsed.CERTIFICATE_RENDER_TIMEOUT_MS,
    chromiumExecutablePath: parsed.CHROMIUM_EXECUTABLE_PATH,
  };
};
