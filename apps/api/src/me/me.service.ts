import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { MeResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { deriveVerificationEmail } from "./verification-email";

@Injectable()
export class MeService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async describe(userId: string): Promise<MeResponse> {
    const user = await this.database.user.findFirst({
      where: { id: userId, deletedAt: null, deactivatedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        mustChangePassword: true,
        profile: { select: { name: true } },
      },
    });
    if (user === null) throw new UnauthorizedException();
    const enrollments = await this.database.enrollment.findMany({
      where: { userId, deletedAt: null },
      orderBy: { requestedAt: "asc" },
      select: {
        status: true,
        course: { select: { id: true, slug: true, title: true } },
        decisions: {
          where: { action: { in: ["REJECT", "REMOVE"] } },
          orderBy: { decidedAt: "desc" },
          take: 1,
          select: { reason: true },
        },
      },
    });
    const latestJob =
      user.emailVerifiedAt === null
        ? await this.database.emailJob.findFirst({
            where: { userId, category: "VERIFICATION", template: "student-verification" },
            orderBy: { queuedAt: "desc" },
            select: { status: true, sentAt: true },
          })
        : null;
    const verificationEmail = deriveVerificationEmail(user.emailVerifiedAt, latestJob);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.profile?.name,
        role: user.role,
        emailVerified: user.emailVerifiedAt !== null,
        mustChangePassword: user.mustChangePassword,
      },
      enrollments: enrollments.map((enrollment) => ({
        courseId: enrollment.course.id,
        courseSlug: enrollment.course.slug,
        courseTitle: enrollment.course.title,
        status: enrollment.status,
        reason: enrollment.decisions[0]?.reason ?? undefined,
      })),
      verificationEmail: verificationEmail.status,
      verificationEmailSentAt: verificationEmail.sentAt?.toISOString() ?? null,
    };
  }
}
