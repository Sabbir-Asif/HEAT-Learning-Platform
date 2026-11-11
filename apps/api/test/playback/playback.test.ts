import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";
import { loadConfig } from "../../src/core";
import { PlaybackController } from "../../src/playback/playback.controller";
import { PlaybackService } from "../../src/playback/playback.service";

const keyOne = "dev-hls-key-one-0123456789abcdefgh";
const keyTwo = "dev-hls-key-two-0123456789abcdefgh";
const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  AUTH_ACCESS_SECRET: "access-secret-0123456789-abcdefghijklmnop",
  AUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  CSRF_SECRET: "csrf-secret-0123456789-abcdefghijklmnopqrs",
};
const now = new Date("2026-11-11T10:00:00.000Z");
const clock = { now: () => now };
const expiry = Math.floor(now.getTime() / 1000) + 600;

const build = (env: Record<string, string>) => {
  const service = new PlaybackService(loadConfig({ ...base, ...env }), clock);
  const cookie = vi.fn();
  const controller = new PlaybackController(service);
  return { service, controller, cookie, response: { cookie, clearCookie: vi.fn() } };
};

describe("PlaybackService", () => {
  test("signs with the active key and expires in ten minutes", () => {
    const { service } = build({ HLS_SIGNING_KEYS: `k1:${keyOne},k2:${keyTwo}` });
    const session = service.issue("abc_1");
    expect(session.value.startsWith(`k1.${expiry}.`)).toBe(true);
    expect(session.value).toHaveLength(`k1.${expiry}.`.length + 64);
    expect(session.expiresAt).toBe("2026-11-11T10:10:00.000Z");
    expect(session.maxAgeMilliseconds).toBe(600_000);
  });

  test("uses the configured active key during rotation", () => {
    const { service } = build({
      HLS_SIGNING_KEYS: `k1:${keyOne},k2:${keyTwo}`,
      HLS_ACTIVE_KEY_ID: "k2",
    });
    expect(service.issue("abc_1").value.startsWith(`k2.${expiry}.`)).toBe(true);
  });

  test("answers 503 when no signing key is configured", () => {
    const { service } = build({});
    expect(() => service.issue("abc_1")).toThrow(ServiceUnavailableException);
  });

  test.each(["..", "a/b", "a b", "", "a.b", "x".repeat(65)])("answers 400 for %j", (id) => {
    const { service } = build({ HLS_SIGNING_KEYS: `k1:${keyOne}` });
    expect(() => service.issue(id)).toThrow(BadRequestException);
  });
});

describe("PlaybackController", () => {
  test("sets hls_sig scoped to the video, HttpOnly, Secure and Strict, for ten minutes", () => {
    const { controller, cookie, response } = build({ HLS_SIGNING_KEYS: `k1:${keyOne}` });
    const body = controller.issue("abc_1", response);
    expect(body).toEqual({ expiresAt: "2026-11-11T10:10:00.000Z" });
    expect(cookie).toHaveBeenCalledTimes(1);
    expect(cookie).toHaveBeenCalledWith(
      "hls_sig",
      expect.stringMatching(/^k1\.\d+\.[0-9a-f]{64}$/),
      {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/hls/abc_1/",
        maxAge: 600_000,
      },
    );
  });

  test("the response body never contains the cookie value", () => {
    const { controller, response } = build({ HLS_SIGNING_KEYS: `k1:${keyOne}` });
    expect(JSON.stringify(controller.issue("abc_1", response))).not.toContain("k1.");
  });
});

describe("PlaybackController guards", () => {
  test("is admin only, role restricted and rate limited per account", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, PlaybackController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, PlaybackController)).toEqual(["ADMIN", "SUPER_ADMIN"]);
    expect(Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, PlaybackController.prototype.issue)).toBe(
      "playbackSession",
    );
  });
});
