import { Module } from "@nestjs/common";
import { AccountProtectionModule } from "../account-protection";
import { AuthModule } from "../auth";
import { CaptchaModule } from "../captcha";
import { CatalogModule } from "../catalog";
import { CoreModule } from "../core";
import { DirectoryModule } from "../directory";
import { EmailVerificationModule } from "../email-verification";
import { RateLimitModule } from "../rate-limit";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";

@Module({
  imports: [
    CoreModule,
    AccountProtectionModule,
    AuthModule,
    CaptchaModule,
    CatalogModule,
    DirectoryModule,
    EmailVerificationModule,
    RateLimitModule,
  ],
  controllers: [EnrollmentController],
  providers: [EnrollmentService],
})
export class EnrollmentModule {}
