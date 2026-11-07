import { Module } from "@nestjs/common";
import { CoreModule } from "./core";
import { HealthController } from "./health/health.controller";
import { HttpApiModule } from "./http/http.module";

@Module({
  imports: [CoreModule, HttpApiModule],
  controllers: [HealthController],
})
export class AppModule {}
