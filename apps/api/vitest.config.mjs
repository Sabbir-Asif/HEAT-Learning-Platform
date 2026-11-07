import { nodePreset } from "@heat/config/vitest";

export default nodePreset({ coverageExclude: ["src/openapi/emit.ts"] });
