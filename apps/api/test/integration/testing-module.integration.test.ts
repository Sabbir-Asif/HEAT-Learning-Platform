import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "../../src/auth";
import { describe, expect, test } from "vitest";
import { TEST_DATABASE, TEST_REDIS_URL, useTestApp } from "../support/testing-module";
import type { HeatClient } from "@heat/db";

@Public()
@Controller("probe")
class ProbeController {
  constructor(
    @Inject(TEST_DATABASE) private readonly database: HeatClient,
    @Inject(TEST_REDIS_URL) private readonly redisUrl: string,
  ) {}

  @Get("users")
  async users() {
    return { users: await this.database.user.count(), redis: this.redisUrl.startsWith("redis://") };
  }
}

describe("the testing module", () => {
  const testApp = useTestApp({ controllers: [ProbeController] });

  test("serves the real application over HTTP", async () => {
    const response = await fetch(`${testApp().baseUrl}/api/health`);

    expect(response.status).toBe(200);
  });

  test("wires providers to the container database and redis", async () => {
    await testApp().factories.approvedStudentInPublishedCourse();

    const response = await fetch(`${testApp().baseUrl}/api/probe/users`);

    expect(await response.json()).toEqual({ users: 2, redis: true });
  });

  test("each test gets a fresh database", async () => {
    const response = await fetch(`${testApp().baseUrl}/api/probe/users`);

    expect(await response.json()).toEqual({ users: 0, redis: true });
  });

  test("environment variables point at the test containers", () => {
    expect(process.env.DATABASE_URL).toBe(testApp().database.url);
    expect(process.env.REDIS_URL).toBe(testApp().redisUrl);
  });
});
