import { Module } from "@nestjs/common";
import { AccountProtectionModule } from "../account-protection";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CaptchaModule } from "../captcha";
import { CoreModule } from "../core";
import { MeModule } from "../me/me.module";
import { RateLimitModule } from "../rate-limit";
import { EmailVerificationService } from "./email-verification.service";
import { VerificationController } from "./verification.controller";
import { VerificationTokenService } from "./verification-token.service";

@Module({
  imports: [
    CoreModule,
    AccountProtectionModule,
    AuditModule,
    AuthModule,
    CaptchaModule,
    MeModule,
    RateLimitModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationTokenService, EmailVerificationService],
  exports: [VerificationTokenService],
})
export class EmailVerificationModule {}
