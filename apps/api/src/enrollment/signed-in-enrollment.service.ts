import { Inject, Injectable } from "@nestjs/common";
import type { SignedInEnrollmentRequest, SignedInEnrollmentResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { CourseLookupService } from "../catalog";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { ENROLLMENT_REQUESTED_EVENT_TYPE } from "./enrollment.service";

type SignedInTransaction = Pick<HeatClient, "user" | "enrollment" | "outbox" | "course">;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

@Injectable()
export class SignedInEnrollmentService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly courses: CourseLookupService,
  ) {}

  async request(
    userId: string,
    { courseSlug }: SignedInEnrollmentRequest,
  ): Promise<SignedInEnrollmentResponse> {
    try {
      return await this.database.$transaction((tx) => this.requestIn(tx, userId, courseSlug));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.database.$transaction((tx) => this.requestIn(tx, userId, courseSlug));
    }
  }

  private async requestIn(
    tx: SignedInTransaction,
    userId: string,
    courseSlug: string,
  ): Promise<SignedInEnrollmentResponse> {
    const user = await tx.user.findFirst({
      where: { id: userId, realm: "STUDENT", deletedAt: null, deactivatedAt: null },
      select: { emailVerifiedAt: true },
    });
    if (user === null) throw new ApiException(401, "UNAUTHENTICATED");
    if (user.emailVerifiedAt === null) throw new ApiException(403, "EMAIL_NOT_VERIFIED");
    const course = await this.courses.resolveOpenForEnrollment(courseSlug, tx);
    const existing = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { id: true, status: true, deletedAt: true, approvedAt: true },
    });
    if (existing !== null && existing.deletedAt === null) {
      return { enrollmentId: existing.id, courseSlug, status: existing.status };
    }
    if (existing !== null && existing.approvedAt !== null) {
      throw new ApiException(409, "ENROLLMENT_ALREADY_DECIDED");
    }
    const at = new Date();
    const enrollment =
      existing === null
        ? await tx.enrollment.create({
            data: {
              userId,
              courseId: course.id,
              status: "PENDING_APPROVAL",
              verifiedAt: at,
            },
            select: { id: true },
          })
        : await tx.enrollment.update({
            where: { id: existing.id },
            data: {
              status: "PENDING_APPROVAL",
              requestedAt: at,
              verifiedAt: at,
              rejectedAt: null,
              expiredAt: null,
              removedAt: null,
              deletedAt: null,
            },
            select: { id: true },
          });
    await tx.outbox.create({
      data: {
        eventType: ENROLLMENT_REQUESTED_EVENT_TYPE,
        payload: { userId, enrollmentId: enrollment.id, courseId: course.id },
      },
    });
    return { enrollmentId: enrollment.id, courseSlug, status: "PENDING_APPROVAL" };
  }
}
