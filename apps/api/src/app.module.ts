import { Module } from "@nestjs/common";
import { AccessModule } from "./access";
import { AccountProtectionModule } from "./account-protection";
import { AdminManagementModule } from "./admin-management";
import { AdminAuthModule } from "./admin-auth/admin-auth.module";
import { AuditModule } from "./audit";
import { AuthModule } from "./auth";
import { CaptchaModule } from "./captcha";
import { CatalogModule } from "./catalog";
import { NewsModule } from "./news";
import { CertificatesModule } from "./certificates";
import { CoreModule } from "./core";
import { DirectoryModule } from "./directory";
import { EmailVerificationModule } from "./email-verification";
import { EnrollmentModule } from "./enrollment/enrollment.module";
import { HealthController } from "./health/health.controller";
import { HttpApiModule } from "./http/http.module";
import { MediaModule } from "./media";
import { MeModule } from "./me/me.module";
import { LearningModule } from "./learning";
import { PlaybackModule } from "./playback";
import { ResourcesModule } from "./resources";
import { StudentsModule } from "./students";
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
    NewsModule,
    CertificatesModule,
    DirectoryModule,
    EmailVerificationModule,
    EnrollmentModule,
    LearningModule,
    MediaModule,
    PlaybackModule,
    ResourcesModule,
    StudentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
