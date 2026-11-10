import { Redis } from "ioredis";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PasswordService } from "../../src/auth";
import { BreachedPasswordProvider } from "../../src/auth/breached-password.provider";
import { REDIS } from "../../src/core";
import { applyEnvironment } from "../support/auth-env";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";

interface Reply {
  status: number;
  retryAfter: number | null;
  code?: string;
}

const useEnvironment = (values: Record<string, string>): void => {
  let restore: (() => void) | undefined;
  beforeEach(() => {
    restore = applyEnvironment(values);
  });
  afterEach(() => {
    restore?.();
  });
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const useHarness = (environment: Record<string, string> = {}) => {
  useEnvironment(environment);
  const testApp = useTestApp();

  const post = async (
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): Promise<Reply> => {
    const response = await fetch(`${testApp().baseUrl}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const retry = response.headers.get("retry-after");
    const parsed = (await response.json().catch(() => undefined)) as
      { error?: { code?: string } } | undefined;
    return {
      status: response.status,
      retryAfter: retry === null ? null : Number(retry),
      code: parsed?.error?.code,
    };
  };

  const signIn = (email: string, secret: string = password, ip?: string) =>
    post("/auth/sign-in", { email, password: secret }, ip ? { "x-forwarded-for": ip } : {});

  const studentWithPassword = async (digest?: string): Promise<string> => {
    const { user } = await testApp().factories.student();
    await testApp().database.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: digest ?? (await testApp().moduleRef.get(PasswordService).hash(password)),
      },
    });
    return user.email;
  };

  return { testApp, post, signIn, studentWithPassword };
};

describe("account lockout with backoff", () => {
  const { testApp, signIn, studentWithPassword } = useHarness({
    LOCKOUT_THRESHOLD: "3",
    LOCKOUT_BASE_SECONDS: "2",
    LOCKOUT_MAX_SECONDS: "8",
  });

  test("locks after the threshold with Retry-After, grows the wait, and clears on success", async () => {
    const email = await studentWithPassword();

    expect((await signIn(email, "wrong-1")).status).toBe(401);
    expect((await signIn(email, "wrong-2")).status).toBe(401);
    expect((await signIn(email, "wrong-3")).status).toBe(401);

    const locked = await signIn(email);
    expect(locked.status).toBe(429);
    expect(locked.code).toBe("RATE_LIMITED");
    expect(locked.retryAfter).toBeGreaterThanOrEqual(1);
    expect(locked.retryAfter).toBeLessThanOrEqual(2);

    await sleep(2200);
    expect((await signIn(email, "wrong-4")).status).toBe(401);
    const longer = await signIn(email);
    expect(longer.status).toBe(429);
    expect(longer.retryAfter).toBeGreaterThan(2);
    expect(longer.retryAfter).toBeLessThanOrEqual(4);

    await sleep(4200);
    expect((await signIn(email)).status).toBe(200);

    expect((await signIn(email, "wrong-5")).status).toBe(401);
    expect((await signIn(email, "wrong-6")).status).toBe(401);
    expect((await signIn(email)).status).toBe(200);
  }, 30_000);

  test("a lock on one account does not touch another", async () => {
    const victim = await studentWithPassword();
    const other = await studentWithPassword();
    for (const attempt of ["a", "b", "c"]) await signIn(victim, attempt);

    expect((await signIn(victim)).status).toBe(429);
    expect((await signIn(other)).status).toBe(200);
  });

  test("unknown addresses lock the same way, so lockout does not reveal accounts", async () => {
    for (const attempt of ["a", "b", "c"]) await signIn("nobody@example.test", attempt);

    expect((await signIn("nobody@example.test")).status).toBe(429);
  });

  test("stores only hashes of addresses", async () => {
    const email = await studentWithPassword();
    await signIn(email, "wrong");
    const redis = new Redis(testApp().redisUrl);
    const keys = await redis.keys("*");
    await redis.quit();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.join("\n")).not.toContain(email);
    expect(keys.join("\n")).not.toContain(email.toUpperCase());
  });
});

describe("shared campus address", () => {
  const { testApp, signIn, studentWithPassword } = useHarness();

  test("200 different students from one IP within a minute are not blocked", async () => {
    const digest = await testApp().moduleRef.get(PasswordService).hash(password);
    const emails: string[] = [];
    for (let index = 0; index < 200; index += 10) {
      emails.push(
        ...(await Promise.all(Array.from({ length: 10 }, () => studentWithPassword(digest)))),
      );
    }

    const statuses: number[] = [];
    for (let index = 0; index < emails.length; index += 20) {
      const batch = await Promise.all(
        emails.slice(index, index + 20).map((email) => signIn(email, password, "203.0.113.7")),
      );
      statuses.push(...batch.map((reply) => reply.status));
    }

    expect(statuses).toHaveLength(200);
    expect(statuses.every((status) => status === 200)).toBe(true);
  }, 120_000);
});

describe("per-IP ceiling", () => {
  const { signIn } = useHarness({ RATE_LIMIT_SIGN_IN_IP_LIMIT: "5" });

  test("a single IP over the ceiling gets 429 while another IP is served", async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 6; index++) {
      statuses.push((await signIn(`user${index}@example.test`, "x", "198.51.100.9")).status);
    }
    const blocked = await signIn("user9@example.test", "x", "198.51.100.9");

    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
    expect((await signIn("user1@example.test", "x", "198.51.100.10")).status).toBe(401);
  });
});

describe("per account and IP limit", () => {
  const { post } = useHarness({
    RATE_LIMIT_ADMIN_SIGN_IN_LIMIT: "2",
    RATE_LIMIT_CAPTCHA_IP_LIMIT: "2",
    LOCKOUT_THRESHOLD: "100",
  });

  test("admin sign-in is limited per account and IP", async () => {
    const call = () => post("/admin/auth/sign-in", { email: "boss@example.test", password: "x" });

    expect((await call()).status).toBe(401);
    expect((await call()).status).toBe(401);
    const blocked = await call();
    expect(blocked.status).toBe(429);
    expect(blocked.code).toBe("RATE_LIMITED");
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  test("the captcha route is limited per IP", async () => {
    expect((await post("/captcha", {})).status).toBe(200);
    expect((await post("/captcha", {})).status).toBe(200);
    const blocked = await post("/captcha", {});
    expect(blocked.status).toBe(429);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });
});

describe("Redis outage", () => {
  const { testApp, signIn, studentWithPassword } = useHarness();

  test("sign-in keeps working and does not enforce limits while Redis is down", async () => {
    const email = await studentWithPassword();
    testApp().moduleRef.get<Redis>(REDIS).disconnect();

    const wrong = [];
    for (let index = 0; index < 12; index++) wrong.push((await signIn(email, "wrong")).status);
    const right = await signIn(email);

    expect(wrong.every((status) => status === 401)).toBe(true);
    expect(right.status).toBe(200);
  }, 30_000);
});

describe("admin change-password limit", () => {
  const { testApp } = useHarness({ RATE_LIMIT_PASSWORD_CHANGE_LIMIT: "2" });

  test("is keyed by the signed-in account and answers 429 with Retry-After", async () => {
    vi.spyOn(testApp().moduleRef.get(BreachedPasswordProvider), "fetchRange").mockResolvedValue("");
    const admin = await testApp().factories.user({ role: "ADMIN" });
    await testApp().database.prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: await testApp().moduleRef.get(PasswordService).hash(password) },
    });
    const signedIn = await fetch(`${testApp().baseUrl}/api/admin/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: admin.email, password }),
    });
    const cookie = signedIn.headers
      .getSetCookie()
      .map((line) => line.split(";")[0] ?? "")
      .join("; ");
    const change = async () =>
      fetch(`${testApp().baseUrl}/api/admin/account/change-password`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          currentPassword: "wrong",
          newPassword: "a different long passphrase",
        }),
      });

    expect((await change()).status).toBe(400);
    expect((await change()).status).toBe(400);
    const blocked = await change();

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
