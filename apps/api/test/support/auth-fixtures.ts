import { loadConfig } from "../../src/core/config";
import type { AppConfig } from "../../src/core";
import { SecretBox } from "../../src/core/secret-box";
import { AccessTokenService } from "../../src/auth/access-token.service";
import { SessionService } from "../../src/auth/session.service";
import { authTestEnvironment } from "./auth-env";
import { FakeClock, InMemoryClaimStore, InMemorySessionStore } from "./fakes";

export const testConfig = (overrides: Record<string, string> = {}): AppConfig =>
  loadConfig({
    DATABASE_URL: "postgresql://unused",
    REDIS_URL: "redis://unused",
    ...authTestEnvironment,
    ...overrides,
  });

export const buildSessionHarness = (overrides: Record<string, string> = {}) => {
  const config = testConfig(overrides);
  const clock = new FakeClock();
  const store = new InMemorySessionStore();
  const claims = new InMemoryClaimStore(clock);
  const accessTokens = new AccessTokenService(config, clock);
  const secretBox = new SecretBox(config.auth.encryptionKey);
  const sleeps: number[] = [];
  const hooks: { onSleep: (count: number) => void } = { onSleep: () => undefined };
  const polling = {
    intervalMs: 50,
    timeoutMs: 1000,
    sleep: async (milliseconds: number) => {
      sleeps.push(milliseconds);
      hooks.onSleep(sleeps.length);
      clock.advanceSeconds(milliseconds / 1000);
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
  const service = new SessionService(
    config,
    clock,
    store,
    claims,
    accessTokens,
    secretBox,
    polling,
  );
  return { config, clock, store, claims, accessTokens, service, sleeps, hooks };
};
