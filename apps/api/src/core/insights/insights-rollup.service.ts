import { Inject, Injectable, Logger } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { CLOCK } from "../clock";
import type { Clock } from "../clock";
import { DATABASE } from "../tokens";
import { DayRebuilder } from "./day-rebuilder";
import { InsightRunner } from "./insight-runner";
import { PrismaRollupSource } from "./prisma-rollup-source";
import { PrismaRollupStore } from "./prisma-rollup-store";
import { PrismaRunStore } from "./prisma-run-store";

@Injectable()
export class InsightsRollupService extends InsightRunner {
  constructor(@Inject(DATABASE) database: HeatClient, @Inject(CLOCK) clock: Clock) {
    const logger = new Logger("InsightsRollup");
    super(
      new PrismaRunStore(database),
      new DayRebuilder(new PrismaRollupSource(database), new PrismaRollupStore(database)),
      clock,
      { info: (line) => logger.log(line), error: (line) => logger.error(line) },
    );
  }
}
