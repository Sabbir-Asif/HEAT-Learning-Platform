import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants";
import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";
import { loadConfig } from "../../src/core";
import { AdminPlaybackController } from "../../src/playback/admin-playback.controller";
import { StudentPlaybackController } from "../../src/playback/student-playback.controller";
import { applyPlaybackGrant } from "../../src/playback/playback-grant";
import type { PlaybackGrant } from "../../src/playback/playback-grant";
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
  return { service, cookie, response: { cookie, clearCookie: vi.fn() } };
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

describe("applyPlaybackGrant", () => {
  const grantFor = (service: PlaybackService, assetKey: string): PlaybackGrant => {
    const session = service.issue(assetKey);
    return {
      assetKey,
      session,
      body: {
        expiresAt: session.expiresAt,
        manifestPath: `/hls/${assetKey}/master.m3u8`,
        sessionId: null,
        resumePositionSeconds: 0,
        captions: [],
      },
    };
  };

  test("sets hls_sig scoped to the asset key, HttpOnly, Secure and Strict, for ten minutes", () => {
    const { service, cookie, response } = build({ HLS_SIGNING_KEYS: `k1:${keyOne}` });
    const body = applyPlaybackGrant(response, grantFor(service, "abc_1"));
    expect(body.expiresAt).toBe("2026-11-11T10:10:00.000Z");
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
    const { service, response } = build({ HLS_SIGNING_KEYS: `k1:${keyOne}` });
    expect(JSON.stringify(applyPlaybackGrant(response, grantFor(service, "abc_1")))).not.toContain(
      "k1.",
    );
  });
});

describe("playback controller guards", () => {
  test("the admin endpoint is admin only, role restricted and rate limited", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, AdminPlaybackController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, AdminPlaybackController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, AdminPlaybackController.prototype.preview),
    ).toBe("playbackSession");
  });

  test("the student endpoints are student audience with the default student role", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, StudentPlaybackController)).toBe("student");
    expect(Reflect.getMetadata(ROLES_KEY, StudentPlaybackController)).toBeUndefined();
    expect(Reflect.getMetadata(PATH_METADATA, StudentPlaybackController)).toBe(
      "videos/:id/playback-session",
    );
  });

  test.each(["start", "refresh"] as const)("the student %s endpoint is rate limited", (name) => {
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, StudentPlaybackController.prototype[name]),
    ).toBe("playbackSession");
  });
});
