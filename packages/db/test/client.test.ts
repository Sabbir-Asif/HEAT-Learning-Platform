import { expect, test } from "vitest";
import { createClient } from "../src/client";

test("createClient returns a client that can disconnect", async () => {
  const client = createClient("postgresql://heat:heat@127.0.0.1:1/heat");
  expect(typeof client.$disconnect).toBe("function");
  await client.$disconnect();
});

test("createClient exposes an include-deleted client", async () => {
  const client = createClient("postgresql://heat:heat@127.0.0.1:1/heat");
  expect(typeof client.$includingDeleted().user.findMany).toBe("function");
  await client.$disconnect();
});
