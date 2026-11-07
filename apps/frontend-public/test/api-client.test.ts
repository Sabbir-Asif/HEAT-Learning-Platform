import { useHealthCheck } from "@heat/api-client";
import type { HealthResponse } from "@heat/contracts";
import { expect, expectTypeOf, test } from "vitest";

function useHealthData() {
  const { data } = useHealthCheck();
  return data;
}

test("the generated health hook returns data typed from the API contract", () => {
  expectTypeOf<ReturnType<typeof useHealthData>>().toEqualTypeOf<HealthResponse | undefined>();
  expectTypeOf<NonNullable<ReturnType<typeof useHealthData>>["status"]>().toEqualTypeOf<"ok">();
  expect(typeof useHealthData).toBe("function");
});
