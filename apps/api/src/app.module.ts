import { Module } from "@nestjs/common";
import { AuthModule } from "./auth";
import { CoreModule } from "./core";
import { HealthController } from "./health/health.controller";
import { HttpApiModule } from "./http/http.module";

@Module({
  imports: [CoreModule, AuthModule, HttpApiModule],
  controllers: [HealthController],
})
export class AppModule {}
