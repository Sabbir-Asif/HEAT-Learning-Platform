import { Module } from "@nestjs/common";
import { AccessModule } from "./access";
import { AdminAuthModule } from "./admin-auth/admin-auth.module";
import { AuthModule } from "./auth";
import { CaptchaModule } from "./captcha";
import { CoreModule } from "./core";
import { HealthController } from "./health/health.controller";
import { HttpApiModule } from "./http/http.module";
import { MeModule } from "./me/me.module";
import { StudentAuthModule } from "./student-auth/student-auth.module";

@Module({
  imports: [
    CoreModule,
    AuthModule,
    AccessModule,
    HttpApiModule,
    MeModule,
    StudentAuthModule,
    AdminAuthModule,
    CaptchaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
