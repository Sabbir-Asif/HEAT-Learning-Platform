import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, expectTypeOf, test } from "vitest";
import { ApiError, useHealthCheck } from "../../../src/index";
import type { HealthResponseDto } from "../../../src/index";
import { getHealthCheckMockHandler, getHealthCheckResponseMock } from "../../../src/mocks";
import { mockApi } from "../../support/msw";

const server = mockApi(getHealthCheckMockHandler());

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useHealthCheck against the generated MSW handler", () => {
  test("returns the typed, deterministic mock", async () => {
    const { result } = renderHook(() => useHealthCheck(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toEqual({ status: "ok" });
    expectTypeOf(result.current.data).toEqualTypeOf<HealthResponseDto | undefined>();
    expectTypeOf(result.current.data?.status).toEqualTypeOf<"ok" | undefined>();
  });

  test("the mock factory always returns the literal", () => {
    expect(getHealthCheckResponseMock()).toEqual({ status: "ok" });
    expect(getHealthCheckResponseMock()).toEqual({ status: "ok" });
  });

  test("an API error reaches the hook as an ApiError with the contracts code", async () => {
    server.use(
      http.get("*/api/health", () =>
        HttpResponse.json(
          { error: { code: "RATE_LIMITED", message: "slow", requestId: "req-1" } },
          { status: 429, headers: { "Retry-After": "5" } },
        ),
      ),
    );
    const { result } = renderHook(() => useHealthCheck(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error).toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      retryAfterSeconds: 5,
    });
    expectTypeOf(result.current.error).toEqualTypeOf<ApiError | null>();
  });
});
