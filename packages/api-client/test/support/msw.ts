import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

export function mockApi(...handlers: RequestHandler[]) {
  const server = setupServer(...handlers);
  const nodeFetch = globalThis.fetch;
  beforeAll(() => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      nodeFetch(
        typeof input === "string" && input.startsWith("/") ? `http://localhost${input}` : input,
        init,
      ),
    );
    server.listen({ onUnhandledFrame: "error" });
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => {
    server.close();
    vi.unstubAllGlobals();
  });
  return server;
}
