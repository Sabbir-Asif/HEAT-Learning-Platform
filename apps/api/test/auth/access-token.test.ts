import { UnauthorizedException } from "@nestjs/common";
import { SignJWT } from "jose";
import { describe, expect, test } from "vitest";
import { AccessTokenService } from "../../src/auth/access-token.service";
import { authTestEnvironment } from "../support/auth-env";
import { testConfig } from "../support/auth-fixtures";
import { FakeClock } from "../support/fakes";

const claims = {
  userId: "0198a000-0000-7000-8000-000000000001",
  familyId: "0198a000-0000-7000-8000-000000000002",
};

describe("AccessTokenService", () => {
  const clock = new FakeClock();
  const service = new AccessTokenService(testConfig(), clock);

  test("round-trips claims for the realm", async () => {
    const { token, expiresAt } = await service.sign({ ...claims, realm: "student" });

    await expect(service.verify(token, "student")).resolves.toEqual({
      ...claims,
      realm: "student",
    });
    expect(expiresAt.getTime() - clock.now().getTime()).toBe(600_000);
  });

  test("rejects a student token for the admin audience", async () => {
    const { token } = await service.sign({ ...claims, realm: "student" });

    await expect(service.verify(token, "admin")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("rejects an expired token", async () => {
    const { token } = await service.sign({ ...claims, realm: "admin" });
    clock.advanceSeconds(601);

    await expect(service.verify(token, "admin")).rejects.toBeInstanceOf(UnauthorizedException);
    clock.advanceSeconds(-601);
  });

  test("rejects garbage and tokens signed with another secret", async () => {
    await expect(service.verify("garbage", "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const forged = await new SignJWT({ sid: claims.familyId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setAudience("student")
      .setIssuer("heat-lms")
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode("another-secret-another-secret-another"));

    await expect(service.verify(forged, "student")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("rejects a token without the session claim", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setAudience("student")
      .setIssuer("heat-lms")
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(authTestEnvironment.AUTH_ACCESS_SECRET));

    await expect(service.verify(token, "student")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
