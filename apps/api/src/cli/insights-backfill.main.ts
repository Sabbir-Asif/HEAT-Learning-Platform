import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { InsightsRollupService } from "../core";
import { runInsightsBackfill } from "./insights-backfill";
import { InsightsBackfillModule } from "./insights-backfill.module";

const output = {
  out: (text: string) => process.stdout.write(text),
  err: (text: string) => process.stderr.write(text),
};

const main = async (): Promise<number> => {
  let context;
  try {
    context = await NestFactory.createApplicationContext(InsightsBackfillModule, {
      logger: ["error"],
    });
  } catch {
    output.err("Backfill failed to start. Check the database and Redis connections.\n");
    return 1;
  }
  try {
    return await runInsightsBackfill(
      process.argv.slice(2),
      context.get(InsightsRollupService),
      output,
    );
  } finally {
    await context.close().catch(() => undefined);
  }
};

main().then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    process.stderr.write("Backfill failed unexpectedly.\n");
    process.exitCode = 1;
  },
);
