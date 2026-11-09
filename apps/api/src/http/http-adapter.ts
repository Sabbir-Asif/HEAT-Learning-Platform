import { ExpressAdapter } from "@nestjs/platform-express";

interface ExpressSettings {
  set(name: string, value: unknown): unknown;
  router: { caseSensitive: boolean; strict: boolean };
}

export const trustedProxyHops = 1;

export function createHttpAdapter(): ExpressAdapter {
  const adapter = new ExpressAdapter();
  const express = adapter.getInstance() as ExpressSettings;
  express.set("case sensitive routing", true);
  express.set("strict routing", true);
  express.set("trust proxy", trustedProxyHops);
  express.router.caseSensitive = true;
  express.router.strict = true;
  return adapter;
}
