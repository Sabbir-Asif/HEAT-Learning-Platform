import { jsdomPreset } from "@heat/config/vitest";

export default jsdomPreset({
  coverageExclude: [
    "**/*.stories.tsx",
    "src/components/**",
    "src/composites/**/*.tsx",
    "src/data/**/*.tsx",
    "src/data/use-table-url-state.ts",
    "src/hooks/**",
  ],
});
