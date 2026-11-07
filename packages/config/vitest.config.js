import { defineConfig, mergeConfig } from "vitest/config";
import { nodePreset } from "./vitest/index.js";

export default mergeConfig(nodePreset(), defineConfig({ test: { testTimeout: 30000 } }));
