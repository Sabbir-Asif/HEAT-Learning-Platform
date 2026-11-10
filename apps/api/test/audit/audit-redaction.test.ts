import { describe, expect, test } from "vitest";
import { redact, redactedMarker } from "../../src/audit/audit-redaction";

describe("redact", () => {
  test("replaces password hashes, tokens, secrets, encrypted tokens and cookies", () => {
    const result = redact({
      email: "a@example.test",
      passwordHash: "$argon2id$v=19$m=19456",
      password: "plain",
      tokenHash: "abc",
      accessToken: "x",
      refresh_token: "y",
      encryptedToken: "z",
      totpSecret: "s",
      clientSecret: "c",
      cookie: "heat=1",
      "set-cookie": "heat=1",
      authorization: "Bearer x",
      recoveryCodes: ["1"],
    });

    expect(result).toEqual({
      email: "a@example.test",
      passwordHash: redactedMarker,
      password: redactedMarker,
      tokenHash: redactedMarker,
      accessToken: redactedMarker,
      refresh_token: redactedMarker,
      encryptedToken: redactedMarker,
      totpSecret: redactedMarker,
      clientSecret: redactedMarker,
      cookie: redactedMarker,
      "set-cookie": redactedMarker,
      authorization: redactedMarker,
      recoveryCodes: redactedMarker,
    });
  });

  test("redacts inside nested objects and arrays without touching the input", () => {
    const input = { user: { name: "n", passwordHash: "h" }, list: [{ token: "t", id: 1 }] };

    const result = redact(input);

    expect(result).toEqual({
      user: { name: "n", passwordHash: redactedMarker },
      list: [{ token: redactedMarker, id: 1 }],
    });
    expect(input.user.passwordHash).toBe("h");
  });

  test("turns dates into ISO strings and keeps primitives", () => {
    expect(
      redact({ at: new Date("2026-11-10T06:00:00.000Z"), n: 1, ok: true, none: null }),
    ).toEqual({ at: "2026-11-10T06:00:00.000Z", n: 1, ok: true, none: null });
  });

  test("drops undefined values and returns null for undefined input", () => {
    expect(redact(undefined)).toBeNull();
    expect(redact({ a: undefined, b: 1 })).toEqual({ b: 1 });
  });

  test("stops at a depth limit instead of recursing forever on a cycle", () => {
    const cyclic: Record<string, unknown> = { id: 1 };
    cyclic.self = cyclic;

    const result = redact(cyclic) as Record<string, unknown>;

    expect(result.id).toBe(1);
    expect(JSON.stringify(result)).toContain(redactedMarker);
  });

  test("keeps flags and nulls on sensitive-looking keys so changes stay readable", () => {
    expect(redact({ mustChangePassword: true, passwordHash: null, status: "ACTIVE" })).toEqual({
      mustChangePassword: true,
      passwordHash: null,
      status: "ACTIVE",
    });
  });
});
