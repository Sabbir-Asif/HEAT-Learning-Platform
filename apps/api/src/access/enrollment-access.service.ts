import { Inject, Injectable } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class EnrollmentAccessService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async hasActiveEnrollment(userId: string, courseId: string): Promise<boolean> {
    if (!uuidPattern.test(courseId)) return false;
    const enrollment = await this.database.enrollment.findFirst({
      where: {
        userId,
        courseId,
        deletedAt: null,
        status: { in: ["APPROVED", "COMPLETED"] },
      },
      select: { id: true },
    });
    return enrollment !== null;
  }
}
