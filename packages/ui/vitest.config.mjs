import { jsdomPreset } from "@heat/config/vitest";

export default jsdomPreset({
  coverageExclude: [
    "**/*.stories.tsx",
    "src/components/**",
    "src/composites/**/*.tsx",
    "src/charts/**/*.tsx",
    "src/upload/**/*.tsx",
    "src/data/**/*.tsx",
    "src/hooks/**",
    "src/shell/**/*.tsx",
  ],
});
