import { describe, expect, test } from "vitest";
import { seedOptionsFromEnv } from "../src/seed";

describe("seedOptionsFromEnv", () => {
  test("reads the super admin variables", () => {
    expect(
      seedOptionsFromEnv({ SUPER_ADMIN_EMAIL: "a@b.test", SUPER_ADMIN_PASSWORD: "secret" }),
    ).toEqual({
      superAdminEmail: "a@b.test",
      superAdminPassword: "secret",
      includeSampleDirectory: false,
    });
  });

  test("includes the sample directory only when the flag is true", () => {
    expect(seedOptionsFromEnv({ SEED_SAMPLE_DIRECTORY: "true" }).includeSampleDirectory).toBe(true);
    expect(seedOptionsFromEnv({ SEED_SAMPLE_DIRECTORY: "yes" }).includeSampleDirectory).toBe(false);
    expect(seedOptionsFromEnv({}).includeSampleDirectory).toBe(false);
  });
});
