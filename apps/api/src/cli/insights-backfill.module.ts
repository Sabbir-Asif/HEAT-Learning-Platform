import { Module } from "@nestjs/common";
import { CoreModule, InsightsRollupService } from "../core";

@Module({
  imports: [CoreModule],
  providers: [InsightsRollupService],
  exports: [InsightsRollupService],
})
export class InsightsBackfillModule {}
