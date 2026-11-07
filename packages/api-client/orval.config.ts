import { defineConfig } from "orval";

const input = { target: "../../apps/api/openapi.json" };

export default defineConfig({
  client: {
    input,
    output: {
      client: "react-query",
      httpClient: "fetch",
      mode: "split",
      target: "src/generated/client/endpoints.ts",
      schemas: "src/generated/client/model",
      clean: true,
      mock: { generators: [{ type: "msw", delay: false }] },
      override: {
        useDates: false,
        fetch: { includeHttpResponseReturnType: false },
        mutator: { path: "src/mutator/custom-fetch.ts", name: "customFetch" },
      },
    },
  },
  server: {
    input,
    output: {
      client: "fetch",
      httpClient: "fetch",
      mode: "single",
      target: "src/generated/server/endpoints.ts",
      clean: true,
      override: {
        useDates: false,
        fetch: { includeHttpResponseReturnType: false },
        mutator: { path: "src/server/server-fetch.ts", name: "serverFetch" },
      },
    },
  },
  zod: {
    input,
    output: {
      client: "zod",
      mode: "single",
      target: "src/generated/zod/schemas.ts",
      clean: true,
    },
  },
});
