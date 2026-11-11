import { Inject, Injectable } from "@nestjs/common";
import type { EnrollmentAcceptedResponse, EnrollmentRequest } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import {
  isActiveEmailConflict,
  RegistrationPolicyService,
  ResponseTiming,
} from "../account-protection";
import type { RegistrationPolicyTransaction } from "../account-protection";
import type { AuditActor } from "../audit";
import { PasswordService } from "../auth";
import { CaptchaService } from "../captcha";
import { CourseLookupService } from "../catalog";
import { DATABASE } from "../core";
import { DepartmentOfferingService } from "../directory";

export const ENROLLMENT_REQUESTED_EVENT_TYPE = "EnrollmentRequested";

type EnrollmentTransaction = RegistrationPolicyTransaction &
  Pick<HeatClient, "course" | "department">;

const accepted: EnrollmentAcceptedResponse = { accepted: true };

@Injectable()
export class EnrollmentService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly captcha: CaptchaService,
    private readonly passwords: PasswordService,
    private readonly courses: CourseLookupService,
    private readonly departments: DepartmentOfferingService,
    private readonly registrations: RegistrationPolicyService,
    private readonly timing: ResponseTiming,
  ) {}

  async submit(request: EnrollmentRequest, actor: AuditActor): Promise<EnrollmentAcceptedResponse> {
    await this.captcha.verify(request.captchaId, request.captchaAnswer);
    await this.passwords.assertNotBreached(request.password);
    return this.timing.equalise(async () => {
      const passwordHash = await this.passwords.hash(request.password);
      try {
        await this.database.$transaction((tx) => this.register(tx, request, passwordHash, actor));
      } catch (error) {
        if (!isActiveEmailConflict(error)) throw error;
      }
      return accepted;
    });
  }

  private async register(
    tx: EnrollmentTransaction,
    request: EnrollmentRequest,
    passwordHash: string,
    actor: AuditActor,
  ): Promise<void> {
    const course = await this.courses.resolveOpenForEnrollment(request.courseSlug, tx);
    await this.departments.assertDepartmentOfferable(request.departmentId, tx, {
      universityId: request.universityId,
      facultyId: request.facultyId,
    });
    const outcome = await this.registrations.apply(tx, request.email, actor);
    if (outcome.kind === "ALREADY_REGISTERED") return;
    const user = await tx.user.create({
      data: { email: request.email, passwordHash, role: "STUDENT", realm: "STUDENT" },
      select: { id: true },
    });
    await tx.studentProfile.create({
      data: {
        userId: user.id,
        name: request.name,
        departmentId: request.departmentId,
        session: request.session,
      },
    });
    const enrollment = await tx.enrollment.create({
      data: { userId: user.id, courseId: course.id, status: "PENDING_VERIFICATION" },
      select: { id: true },
    });
    await tx.outbox.create({
      data: {
        eventType: ENROLLMENT_REQUESTED_EVENT_TYPE,
        payload: { userId: user.id, enrollmentId: enrollment.id, courseId: course.id },
      },
    });
  }
}
