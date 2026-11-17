import { nodePreset } from "@heat/config/vitest";
import { configDefaults, mergeConfig } from "vitest/config";

const ruleModuleGate = { lines: 100, functions: 100, branches: 100, statements: 100 };

export default mergeConfig(
  nodePreset({
    coverageExclude: [
      "src/openapi/emit.ts",
      "src/core/insights/prisma-*.ts",
      "src/core/insights/insights-rollup.service.ts",
      "src/cli/insights-backfill.main.ts",
      "src/cli/insights-backfill.module.ts",
    ],
  }),
  {
    test: {
      exclude: [...configDefaults.exclude, "test/integration/**"],
      coverage: {
        thresholds: {
          "src/learning/quiz-submission-rules.ts": ruleModuleGate,
          "src/learning/module-completion-rules.ts": ruleModuleGate,
          "src/learning/learning-rules.ts": ruleModuleGate,
          "src/playback/progress-rules.ts": ruleModuleGate,
        },
      },
    },
  },
);
