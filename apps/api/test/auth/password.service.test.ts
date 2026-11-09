import { createHash } from "node:crypto";
import { Logger } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { BreachedPasswordProvider } from "../../src/auth/breached-password.provider";
import { PasswordService } from "../../src/auth/password.service";
import { ApiException } from "../../src/http/api-exception";
import { testConfig } from "../support/auth-fixtures";

class StubProvider extends BreachedPasswordProvider {
  readonly prefixes: string[] = [];

  constructor(private readonly respond: (prefix: string) => string | Error) {
    super();
  }

  fetchRange(prefix: string): Promise<string> {
    this.prefixes.push(prefix);
    const result = this.respond(prefix);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  }
}

const sha1 = (value: string) => createHash("sha1").update(value).digest("hex").toUpperCase();

describe("hashing", () => {
  const service = new PasswordService(testConfig(), new StubProvider(() => ""));

  test("produces an argon2id hash that verifies", async () => {
    const digest = await service.hash("correct horse battery");

    expect(digest).toMatch(/^\$argon2id\$/);
    await expect(service.verify(digest, "correct horse battery")).resolves.toBe(true);
    await expect(service.verify(digest, "wrong")).resolves.toBe(false);
  });

  test("treats a malformed hash as a failed verification", async () => {
    await expect(service.verify("not-a-hash", "anything")).resolves.toBe(false);
  });

  test("flags a hash made with weaker parameters for rehash", async () => {
    const weak = await new PasswordService(
      testConfig({ ARGON2_MEMORY_COST: "8", ARGON2_TIME_COST: "1" }),
      new StubProvider(() => ""),
    ).hash("password-one");
    const strong = new PasswordService(
      testConfig({ ARGON2_MEMORY_COST: "16", ARGON2_TIME_COST: "2" }),
      new StubProvider(() => ""),
    );

    expect(strong.needsRehash(weak)).toBe(true);
    expect(service.needsRehash(weak)).toBe(false);
  });
});

describe("breached password check", () => {
  const password = "P@ssw0rd-breached";
  const hash = sha1(password);

  test("sends only the five character prefix", async () => {
    const provider = new StubProvider(() => "");
    await new PasswordService(testConfig(), provider).assertNotBreached(password);

    expect(provider.prefixes).toEqual([hash.slice(0, 5)]);
  });

  test("refuses a password found in the range response with a stable code", async () => {
    const provider = new StubProvider(
      () => `0000000000000000000000000000000000A:0\r\n${hash.slice(5)}:42\r\nFFFF:1`,
    );
    const service = new PasswordService(testConfig(), provider);

    const failure = await service.assertNotBreached(password).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiException);
    expect(failure).toMatchObject({ code: "PASSWORD_BREACHED" });
    expect((failure as ApiException).getStatus()).toBe(400);
  });

  test("ignores padding entries with a zero count", async () => {
    const provider = new StubProvider(() => `${hash.slice(5)}:0`);

    await expect(
      new PasswordService(testConfig(), provider).assertNotBreached(password),
    ).resolves.toBeUndefined();
  });

  test("fails open with a warning that carries no password data", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const provider = new StubProvider(() => new Error(`down ${password}`));

    await expect(
      new PasswordService(testConfig(), provider).assertNotBreached(password),
    ).resolves.toBeUndefined();

    const logged = warn.mock.calls.map(([message]) => String(message)).join(" ");
    warn.mockRestore();
    expect(logged).toContain("unavailable");
    expect(logged).not.toContain(password);
    expect(logged).not.toContain(hash.slice(0, 5));
  });

  test("hashChecked refuses a breached password and hashes a clean one", async () => {
    const breached = new PasswordService(
      testConfig(),
      new StubProvider(() => `${hash.slice(5)}:3`),
    );
    await expect(breached.hashChecked(password)).rejects.toBeInstanceOf(ApiException);

    const clean = new PasswordService(testConfig(), new StubProvider(() => ""));
    await expect(clean.hashChecked(password)).resolves.toMatch(/^\$argon2id\$/);
  });
});
