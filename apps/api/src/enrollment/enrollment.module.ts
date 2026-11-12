import { Module } from "@nestjs/common";
import { AccountProtectionModule } from "../account-protection";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CaptchaModule } from "../captcha";
import { CatalogModule } from "../catalog";
import { CoreModule } from "../core";
import { DirectoryModule } from "../directory";
import { EmailVerificationModule } from "../email-verification";
import { RateLimitModule } from "../rate-limit";
import { ApprovalQueueService } from "./approval-queue.service";
import { EnrollmentApprovalController } from "./enrollment-approval.controller";
import { EnrollmentApprovalService } from "./enrollment-approval.service";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";
import { SignedInEnrollmentController } from "./signed-in-enrollment.controller";
import { SignedInEnrollmentService } from "./signed-in-enrollment.service";

@Module({
  imports: [
    CoreModule,
    AccountProtectionModule,
    AuditModule,
    AuthModule,
    CaptchaModule,
    CatalogModule,
    DirectoryModule,
    EmailVerificationModule,
    RateLimitModule,
  ],
  controllers: [EnrollmentController, EnrollmentApprovalController, SignedInEnrollmentController],
  providers: [
    EnrollmentService,
    EnrollmentApprovalService,
    ApprovalQueueService,
    SignedInEnrollmentService,
  ],
})
export class EnrollmentModule {}
