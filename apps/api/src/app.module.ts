import { Module } from "@nestjs/common";
import { AccessModule } from "./access";
import { AccountProtectionModule } from "./account-protection";
import { AdminManagementModule } from "./admin-management";
import { AdminAuthModule } from "./admin-auth/admin-auth.module";
import { AuditModule } from "./audit";
import { AuthModule } from "./auth";
import { CaptchaModule } from "./captcha";
import { CatalogModule } from "./catalog";
import { CoreModule } from "./core";
import { DirectoryModule } from "./directory";
import { EnrollmentModule } from "./enrollment/enrollment.module";
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
    AccountProtectionModule,
    HttpApiModule,
    MeModule,
    StudentAuthModule,
    AdminAuthModule,
    AdminManagementModule,
    CaptchaModule,
    CatalogModule,
    DirectoryModule,
    EnrollmentModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
