import { createServer } from "node:net";
import type { Server, Socket } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import { createRateLimitRedis } from "../../src/rate-limit/rate-limit-redis";

let server: Server | undefined;
const sockets: Socket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.destroy();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)));
  server = undefined;
});

describe("createRateLimitRedis", () => {
  test("a Redis that accepts connections but never answers fails fast", async () => {
    server = createServer((socket) => {
      sockets.push(socket);
    });
    for (const socket of sockets.splice(0)) socket.destroy();
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const client = createRateLimitRedis(`redis://127.0.0.1:${port}`, 100);

    const started = Date.now();
    await expect(client.get("anything")).rejects.toThrow();
    const elapsed = Date.now() - started;
    client.disconnect();

    expect(elapsed).toBeLessThan(1500);
  });

  test("carries the configured command timeout", () => {
    const client = createRateLimitRedis("redis://127.0.0.1:1", 250);
    expect(client.options.commandTimeout).toBe(250);
    client.disconnect();
  });
});

describe("createRateLimitRedis error handling", () => {
  test("connection errors are swallowed instead of crashing the process", () => {
    const client = createRateLimitRedis("redis://127.0.0.1:1", 100);

    expect(() => client.emit("error", new Error("connection refused"))).not.toThrow();
    client.disconnect();
  });
});
