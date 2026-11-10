import { jsdomPreset } from "@heat/config/vitest";

export default jsdomPreset({
  threshold: 0,
  coverageExclude: ["src/app/**/page.tsx", "src/app/**/layout.tsx"],
});
