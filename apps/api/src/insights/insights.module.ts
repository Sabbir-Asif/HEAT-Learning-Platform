import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CoreModule, InsightsRollupService } from "../core";
import { AdminOverviewController } from "./admin-overview.controller";
import { AdminOverviewService } from "./admin-overview.service";
import { InsightsController } from "./insights.controller";
import { InsightsQueryService } from "./insights-query.service";
import { InsightsRefreshService } from "./insights-refresh.service";

@Module({
  imports: [CoreModule, AuthModule, AuditModule],
  controllers: [InsightsController, AdminOverviewController],
  providers: [
    AdminOverviewService,
    InsightsRollupService,
    InsightsQueryService,
    InsightsRefreshService,
  ],
})
export class InsightsModule {}
