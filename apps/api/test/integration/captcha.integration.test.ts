import { Redis } from "ioredis";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CaptchaModule, CaptchaService } from "../../src/captcha";
import { RedisCaptchaStore } from "../../src/captcha/redis-captcha.store";
import { loadConfig } from "../../src/core";
import { authTestEnvironment } from "../support/auth-env";
import { alphabet } from "../../src/captcha/captcha-text";
import { CaptchaProbeController } from "../support/captcha-probe.controller";
import { StubEntropy } from "../support/fakes";
import { useTestApp } from "../support/testing-module";

const fixedAnswer = [0, 1, 2, 3, 4, 5].map((index) => alphabet[index]).join("");

interface Reply {
  status: number;
  body: { id?: string; svg?: string; error?: { code: string } };
}

describe("captcha over HTTP and Redis", () => {
  const testApp = useTestApp({ imports: [CaptchaModule], controllers: [CaptchaProbeController] });
  let redis: Redis;

  beforeEach(() => {
    redis = new Redis(testApp().redisUrl);
  });

  afterEach(async () => {
    await redis.quit();
  });

  const post = async (path: string, body: unknown = {}): Promise<Reply> => {
    const response = await fetch(`${testApp().baseUrl}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as Reply["body"] };
  };

  const issue = async (replaces?: string) => {
    const reply = await post("/captcha", replaces === undefined ? {} : { replaces });
    expect(reply.status).toBe(200);
    return reply.body as { id: string; svg: string };
  };

  test("issues an id and an svg without text nodes", async () => {
    const { id, svg } = await issue();

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("<text");
  });

  test("stores only a hash of the answer with a five minute lifetime", async () => {
    const { id } = await issue();

    const stored = await redis.hgetall(`captcha:${id}`);
    const ttl = await redis.ttl(`captcha:${id}`);

    expect(Object.keys(stored).sort()).toEqual(["hash", "tries"]);
    expect(stored["hash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(stored["tries"]).toBe("0");
    expect(ttl).toBeGreaterThan(290);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  test("a refresh removes the previous id from Redis", async () => {
    const first = await issue();

    const second = await issue(first.id);

    expect(await redis.exists(`captcha:${first.id}`)).toBe(0);
    expect(await redis.exists(`captcha:${second.id}`)).toBe(1);
    const reply = await post("/captcha-probe", { captchaId: first.id, captchaAnswer: "ABCDEF" });
    expect(reply.status).toBe(400);
    expect(reply.body.error?.code).toBe("CAPTCHA_EXPIRED");
  });

  test("a protected request with an unknown answer is invalid, then exhausted after three", async () => {
    const { id } = await issue();
    const attempt = () => post("/captcha-probe", { captchaId: id, captchaAnswer: "NOPE22" });

    expect((await attempt()).body.error?.code).toBe("CAPTCHA_INVALID");
    expect((await attempt()).body.error?.code).toBe("CAPTCHA_INVALID");
    expect((await attempt()).body.error?.code).toBe("CAPTCHA_EXPIRED");
    expect((await attempt()).body.error?.code).toBe("CAPTCHA_EXPIRED");
    expect(await redis.exists(`captcha:${id}`)).toBe(0);
  });

  test("a protected request without the captcha fields fails validation", async () => {
    const reply = await post("/captcha-probe", {});

    expect(reply.status).toBe(400);
    expect(reply.body.error?.code).toBe("VALIDATION_FAILED");
  });

  test("the key disappears once its lifetime ends", async () => {
    const { id } = await issue();

    await redis.pexpire(`captcha:${id}`, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const reply = await post("/captcha-probe", { captchaId: id, captchaAnswer: "ABCDEF" });
    expect(reply.body.error?.code).toBe("CAPTCHA_EXPIRED");
  });

  test("concurrent wrong answers cannot exceed three tries", async () => {
    const { id } = await issue();

    const replies = await Promise.all(
      Array.from({ length: 8 }, () =>
        post("/captcha-probe", { captchaId: id, captchaAnswer: "NOPE22" }),
      ),
    );

    const invalid = replies.filter((reply) => reply.body.error?.code === "CAPTCHA_INVALID");
    expect(invalid).toHaveLength(2);
  });
});

describe("a correct answer against real Redis", () => {
  const testApp = useTestApp();

  test("passes once, is case-insensitive and cannot be reused", async () => {
    const redis = new Redis(testApp().redisUrl);
    const config = loadConfig({
      ...authTestEnvironment,
      DATABASE_URL: "postgresql://x",
      REDIS_URL: testApp().redisUrl,
    });
    const service = new CaptchaService(new RedisCaptchaStore(redis), config, new StubEntropy());
    const { id } = await service.issue();

    await expect(service.verify(id, fixedAnswer.toLowerCase())).resolves.toBeUndefined();
    await expect(service.verify(id, fixedAnswer)).rejects.toMatchObject({
      code: "CAPTCHA_EXPIRED",
    });
    expect(await redis.exists(`captcha:${id}`)).toBe(0);
    await redis.quit();
  });
});
