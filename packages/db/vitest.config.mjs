import { nodePreset } from "@heat/config/vitest";
import { configDefaults, mergeConfig } from "vitest/config";

export default mergeConfig(nodePreset({ coverageExclude: ["src/generated/**"] }), {
  test: { exclude: [...configDefaults.exclude, "test/integration/**"] },
});
