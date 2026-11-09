import { Module } from "@nestjs/common";
import { AccessModule } from "./access";
import { AuthModule } from "./auth";
import { CoreModule } from "./core";
import { HealthController } from "./health/health.controller";
import { HttpApiModule } from "./http/http.module";
import { MeModule } from "./me/me.module";
import { StudentAuthModule } from "./student-auth/student-auth.module";

@Module({
  imports: [CoreModule, AuthModule, AccessModule, HttpApiModule, MeModule, StudentAuthModule],
  controllers: [HealthController],
})
export class AppModule {}
