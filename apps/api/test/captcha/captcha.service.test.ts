import { describe, expect, test } from "vitest";
import { captchaTtlSeconds } from "@heat/contracts";
import { loadConfig } from "../../src/core";
import { CaptchaService } from "../../src/captcha/captcha.service";
import { alphabet } from "../../src/captcha/captcha-text";
import { authTestEnvironment } from "../support/auth-env";
import { FakeClock, InMemoryCaptchaStore, StubEntropy } from "../support/fakes";

const config = loadConfig({
  ...authTestEnvironment,
  DATABASE_URL: "postgresql://x",
  REDIS_URL: "redis://x",
});

const build = () => {
  const clock = new FakeClock();
  const store = new InMemoryCaptchaStore(clock);
  const service = new CaptchaService(store, config, new StubEntropy());
  return { clock, store, service };
};

const expectedText = [0, 1, 2, 3, 4, 5].map((index) => alphabet[index]).join("");

const code = async (promise: Promise<unknown>): Promise<string | null> => {
  try {
    await promise;
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
};

describe("CaptchaService", () => {
  test("issues an id, an image and the lifetime", async () => {
    const { service } = build();

    const issued = await service.issue();

    expect(issued.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(issued.svg.startsWith("<svg")).toBe(true);
    expect(issued.expiresInSeconds).toBe(captchaTtlSeconds);
  });

  test("the correct answer passes once and cannot be used again", async () => {
    const { service } = build();
    const { id } = await service.issue();

    await expect(service.verify(id, expectedText)).resolves.toBeUndefined();
    expect(await code(service.verify(id, expectedText))).toBe("CAPTCHA_EXPIRED");
  });

  test("the check ignores case and spaces", async () => {
    const { service } = build();
    const { id } = await service.issue();

    await expect(
      service.verify(id, ` ${expectedText.toLowerCase().split("").join(" ")} `),
    ).resolves.toBeUndefined();
  });

  test("a wrong answer is invalid and the same captcha stays usable until the third miss", async () => {
    const { service } = build();
    const { id } = await service.issue();

    expect(await code(service.verify(id, "WRONG1"))).toBe("CAPTCHA_INVALID");
    expect(await code(service.verify(id, "WRONG2"))).toBe("CAPTCHA_INVALID");
    await expect(service.verify(id, expectedText)).resolves.toBeUndefined();
  });

  test("after three wrong answers even the right one fails and a new captcha is needed", async () => {
    const { service } = build();
    const { id } = await service.issue();

    expect(await code(service.verify(id, "WRONG1"))).toBe("CAPTCHA_INVALID");
    expect(await code(service.verify(id, "WRONG2"))).toBe("CAPTCHA_INVALID");
    expect(await code(service.verify(id, "WRONG3"))).toBe("CAPTCHA_EXPIRED");
    expect(await code(service.verify(id, expectedText))).toBe("CAPTCHA_EXPIRED");
  });

  test("an answer after five minutes fails as expired", async () => {
    const { clock, service } = build();
    const { id } = await service.issue();

    clock.advanceSeconds(captchaTtlSeconds + 1);

    expect(await code(service.verify(id, expectedText))).toBe("CAPTCHA_EXPIRED");
  });

  test("an answer just inside five minutes still passes", async () => {
    const { clock, service } = build();
    const { id } = await service.issue();

    clock.advanceSeconds(captchaTtlSeconds - 1);

    await expect(service.verify(id, expectedText)).resolves.toBeUndefined();
  });

  test("a refresh invalidates the previous id", async () => {
    const { service } = build();
    const first = await service.issue();

    const second = await service.issue(first.id);

    expect(second.id).not.toBe(first.id);
    expect(await code(service.verify(first.id, expectedText))).toBe("CAPTCHA_EXPIRED");
    await expect(service.verify(second.id, expectedText)).resolves.toBeUndefined();
  });

  test("refreshing an unknown id is harmless", async () => {
    const { service } = build();

    await expect(service.issue("6f1c1c1e-4d3a-4c55-8a39-0d3c2f9b1a11")).resolves.toBeDefined();
  });

  test("an unknown id fails as expired", async () => {
    const { service } = build();

    expect(await code(service.verify("6f1c1c1e-4d3a-4c55-8a39-0d3c2f9b1a11", "ABCDEF"))).toBe(
      "CAPTCHA_EXPIRED",
    );
  });

  test("the store only ever sees a keyed hash of the answer", async () => {
    const { store, service } = build();
    await service.issue();

    const [stored] = store.hashes();

    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain(expectedText);
  });

  test("the same answer hashes differently for two captchas", async () => {
    const { store, service } = build();
    await service.issue();
    await service.issue();

    const [first, second] = store.hashes();

    expect(first).not.toBe(second);
  });
});
