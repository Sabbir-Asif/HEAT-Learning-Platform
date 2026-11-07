import { nodePreset } from "@heat/config/vitest";

// emit.ts is the command-line entry that calls the tested writeOpenApiDocument.
export default nodePreset({ coverageExclude: ["src/openapi/emit.ts"] });
