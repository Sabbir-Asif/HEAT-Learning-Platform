import { jsdomPreset } from "@heat/config/vitest";

export default jsdomPreset({
  coverageExclude: ["**/*.stories.tsx", "src/components/**", "src/hooks/**"],
});
