import { jsdomPreset } from "@heat/config/vitest";

export default jsdomPreset({
  threshold: 0,
  coverageExclude: [
    "**/*.stories.tsx",
    "**/index.ts",
    "src/components/**",
    "src/composites/**/*.tsx",
    "src/data/**/*.tsx",
    "src/hooks/**",
  ],
});
