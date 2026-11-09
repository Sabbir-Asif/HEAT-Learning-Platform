import { jsdomPreset } from "@heat/config/vitest";

export default jsdomPreset({ coverageExclude: ["src/app/**", "src/shell/**/*.tsx"] });
