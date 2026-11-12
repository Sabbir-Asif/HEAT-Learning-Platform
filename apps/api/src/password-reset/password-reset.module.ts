import { Module } from "@nestjs/common";
import { AccountProtectionModule } from "../account-protection";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CaptchaModule } from "../captcha";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { PasswordResetController } from "./password-reset.controller";
import { PasswordResetService } from "./password-reset.service";

@Module({
  imports: [
    CoreModule,
    AccountProtectionModule,
    AuditModule,
    AuthModule,
    CaptchaModule,
    RateLimitModule,
  ],
  controllers: [PasswordResetController],
  providers: [PasswordResetService],
})
export class PasswordResetModule {}
