import { describe, expect, test } from "vitest";
import { loadEmailQuotaConfig } from "../../src/email/email-quota-config";

describe("loadEmailQuotaConfig", () => {
  test("defaults to the Gmail limit with reserved capacity for verification and password mail", () => {
    expect(loadEmailQuotaConfig({})).toEqual({
      totalLimit: 500,
      reservedForPriority: 150,
      budgets: { VERIFICATION: 300, PASSWORD: 150, ENROLLMENT: 150, CERTIFICATE: 100 },
    });
  });

  test("reads overrides from the environment and treats blanks as unset", () => {
    expect(
      loadEmailQuotaConfig({
        EMAIL_DAILY_LIMIT: "5",
        EMAIL_RESERVED_CAPACITY: "1",
        EMAIL_BUDGET_ENROLLMENT: "2",
        EMAIL_BUDGET_CERTIFICATE: "",
      }),
    ).toMatchObject({
      totalLimit: 5,
      reservedForPriority: 1,
      budgets: { ENROLLMENT: 2, CERTIFICATE: 100 },
    });
  });

  test("rejects values that are not whole numbers or that reserve more than the limit", () => {
    expect(() => loadEmailQuotaConfig({ EMAIL_DAILY_LIMIT: "many" })).toThrow(
      "Invalid environment configuration: EMAIL_DAILY_LIMIT",
    );
    expect(() =>
      loadEmailQuotaConfig({ EMAIL_DAILY_LIMIT: "10", EMAIL_RESERVED_CAPACITY: "11" }),
    ).toThrow("Invalid environment configuration: EMAIL_RESERVED_CAPACITY");
  });
});
