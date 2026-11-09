import { jsdomPreset } from "@heat/config/vitest";

export default jsdomPreset({
  coverageExclude: ["src/app/**/page.tsx", "src/app/**/layout.tsx"],
});
