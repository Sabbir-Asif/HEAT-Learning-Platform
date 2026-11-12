import { Module } from "@nestjs/common";
import { AccountProtectionModule } from "../account-protection";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CaptchaModule } from "../captcha";
import { CatalogModule } from "../catalog";
import { CoreModule } from "../core";
import { DirectoryModule } from "../directory";
import { EmailVerificationModule } from "../email-verification";
import { NotificationsModule } from "../notifications";
import { RateLimitModule } from "../rate-limit";
import { ApprovalQueueService } from "./approval-queue.service";
import { EnrollmentApprovalController } from "./enrollment-approval.controller";
import { EnrollmentRemovalController } from "./enrollment-removal.controller";
import { EnrollmentApprovalService } from "./enrollment-approval.service";
import { EnrollmentRejectionService } from "./enrollment-rejection.service";
import { EnrollmentRemovalService } from "./enrollment-removal.service";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";
import { StudentListController } from "./student-list.controller";
import { StudentListService } from "./student-list.service";

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
    NotificationsModule,
    RateLimitModule,
  ],
  controllers: [
    EnrollmentController,
    EnrollmentApprovalController,
    EnrollmentRemovalController,
    StudentListController,
  ],
  providers: [
    EnrollmentService,
    EnrollmentApprovalService,
    EnrollmentRejectionService,
    EnrollmentRemovalService,
    ApprovalQueueService,
    StudentListService,
  ],
})
export class EnrollmentModule {}
