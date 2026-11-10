import { Module } from "@nestjs/common";
import { AccessModule } from "./access";
import { AdminManagementModule } from "./admin-management";
import { AdminAuthModule } from "./admin-auth/admin-auth.module";
import { AuditModule } from "./audit";
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
    AuditModule,
    HttpApiModule,
    MeModule,
    StudentAuthModule,
    AdminAuthModule,
    AdminManagementModule,
    CaptchaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
