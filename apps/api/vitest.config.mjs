import { nodePreset } from "@heat/config/vitest";
import { configDefaults, mergeConfig } from "vitest/config";

export default mergeConfig(nodePreset({ coverageExclude: ["src/openapi/emit.ts"] }), {
  test: { exclude: [...configDefaults.exclude, "test/integration/**"] },
});
