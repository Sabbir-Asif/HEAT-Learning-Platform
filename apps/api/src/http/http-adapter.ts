import { randomUUID } from "node:crypto";
import { ExpressAdapter } from "@nestjs/platform-express";

interface ExpressSettings {
  set(name: string, value: unknown): unknown;
  router: { caseSensitive: boolean; strict: boolean };
  use(
    handler: (
      request: { headers: Record<string, string | string[] | undefined> },
      response: { setHeader(name: string, value: string): unknown },
      next: () => void,
    ) => void,
  ): unknown;
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
  express.use((request, response, next) => {
    const requestId = randomUUID();
    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  });
  return adapter;
}
