import { jsdomPreset } from "@heat/config/vitest";

// Stories run in a browser through vitest.stories.config.mjs, so they are not part of this gate.
export default jsdomPreset({ coverageExclude: ["**/*.stories.tsx"] });
