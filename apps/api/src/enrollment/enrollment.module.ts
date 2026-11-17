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
import { AttemptGrantController } from "./attempt-grant.controller";
import { AttemptGrantService } from "./attempt-grant.service";
import { ApprovalQueueService } from "./approval-queue.service";
import { EnrollmentApprovalController } from "./enrollment-approval.controller";
import { EnrollmentRemovalController } from "./enrollment-removal.controller";
import { EnrollmentApprovalService } from "./enrollment-approval.service";
import { EnrollmentRejectionService } from "./enrollment-rejection.service";
import { EnrollmentRemovalService } from "./enrollment-removal.service";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";
import { StudentExportController } from "./student-export.controller";
import { StudentExportService } from "./student-export.service";
import { StudentDetailController } from "./student-detail.controller";
import { StudentDetailService } from "./student-detail.service";
import { StudentListController } from "./student-list.controller";
import { StudentListService } from "./student-list.service";
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
    NotificationsModule,
    RateLimitModule,
  ],
  controllers: [
    EnrollmentController,
    EnrollmentApprovalController,
    EnrollmentRemovalController,
    AttemptGrantController,
    StudentListController,
    StudentExportController,
    StudentDetailController,
    SignedInEnrollmentController,
  ],
  providers: [
    EnrollmentService,
    EnrollmentApprovalService,
    EnrollmentRejectionService,
    EnrollmentRemovalService,
    AttemptGrantService,
    ApprovalQueueService,
    StudentListService,
    StudentExportService,
    StudentDetailService,
    SignedInEnrollmentService,
  ],
})
export class EnrollmentModule {}
