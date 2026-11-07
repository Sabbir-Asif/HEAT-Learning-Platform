import { useHealthCheck } from "@heat/api-client";
import type { HealthResponse } from "@heat/contracts";
import { expect, expectTypeOf, test } from "vitest";

// Never called: it only has to type-check, the way a screen would use the hook.
function useHealthData() {
  const { data } = useHealthCheck();
  return data;
}

test("the generated health hook returns data typed from the API contract", () => {
  // Checked by `pnpm typecheck`: `data.status` is the literal "ok", the same type as @heat/contracts.
  expectTypeOf<ReturnType<typeof useHealthData>>().toEqualTypeOf<HealthResponse | undefined>();
  expectTypeOf<NonNullable<ReturnType<typeof useHealthData>>["status"]>().toEqualTypeOf<"ok">();
  expect(typeof useHealthData).toBe("function");
});
