import { describe, expect, test, vi } from "vitest";
import { CaptchaController } from "../../src/captcha/captcha.controller";
import { cryptoEntropy } from "../../src/captcha/captcha-entropy";
import { defaultClaimPolling } from "../../src/auth/claim-polling";

describe("CaptchaController.issue", () => {
  test("issues a challenge that replaces the previous one", async () => {
    const issue = vi.fn().mockResolvedValue({ id: "challenge" });
    const controller = new CaptchaController({ issue } as never);

    expect(await controller.issue({ replaces: "old" })).toEqual({ id: "challenge" });
    expect(issue).toHaveBeenCalledWith("old");
  });
});

describe("cryptoEntropy", () => {
  test("int stays below the bound and unit stays in [0, 1)", () => {
    for (let index = 0; index < 50; index++) {
      expect(cryptoEntropy.int(7)).toBeGreaterThanOrEqual(0);
      expect(cryptoEntropy.int(7)).toBeLessThan(7);
      const unit = cryptoEntropy.unit();
      expect(unit).toBeGreaterThanOrEqual(0);
      expect(unit).toBeLessThan(1);
    }
  });
});

describe("defaultClaimPolling", () => {
  test("sleeps for the requested time", async () => {
    const started = performance.now();
    await defaultClaimPolling.sleep(15);
    expect(performance.now() - started).toBeGreaterThanOrEqual(10);
    expect(defaultClaimPolling.intervalMs).toBeLessThan(defaultClaimPolling.timeoutMs);
  });
});
