import { jsdomPreset } from "@heat/config/vitest";

export default jsdomPreset({
  coverageExclude: [
    "**/*.stories.tsx",
    "**/index.ts",
    "src/components/**",
    "src/composites/**/*.tsx",
    "src/data/**/*.tsx",
    "src/hooks/**",
  ],
});
