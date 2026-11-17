import { Inject, Injectable } from "@nestjs/common";
import type {
  LatestProfileChangeResponse,
  ProfileChangeRequestSummary,
  SubmitProfileChangeRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { DepartmentOfferingService } from "../directory";
import { ApiException } from "../http/api-exception";
import { presentRequest, requestSelect } from "./profile-change-presenter";
import {
  assertSomethingChanges,
  departmentIsChanging,
  isUniqueViolation,
  pairIsChanging,
  requestedChanges,
} from "./profile-change-rules";

const currentSelect = {
  name: true,
  session: true,
  department: {
    select: {
      id: true,
      universityFaculty: { select: { universityId: true, facultyId: true } },
    },
  },
} as const;

@Injectable()
export class ProfileChangeService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly departments: DepartmentOfferingService,
  ) {}

  async latest(userId: string): Promise<LatestProfileChangeResponse> {
    const row = await this.database.profileChangeRequest.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: requestSelect,
    });
    return { request: row === null ? null : presentRequest(row) };
  }

  async submit(
    userId: string,
    request: SubmitProfileChangeRequest,
  ): Promise<ProfileChangeRequestSummary> {
    const current = await this.database.studentProfile.findFirst({
      where: { userId, deletedAt: null },
      select: currentSelect,
    });
    if (current === null) throw new ApiException(404, "NOT_FOUND");
    await this.assertNoOpenRequest(userId);
    if (departmentIsChanging(current, request) || pairIsChanging(current, request)) {
      await this.departments.assertDepartmentOfferable(request.departmentId, this.database, {
        universityId: request.universityId,
        facultyId: request.facultyId,
      });
    }
    const changes = requestedChanges(current, request);
    assertSomethingChanges(changes);
    try {
      const created = await this.database.profileChangeRequest.create({
        data: {
          userId,
          ...(changes.name === undefined ? {} : { requestedName: changes.name }),
          ...(changes.departmentId === undefined
            ? {}
            : { requestedDepartmentId: changes.departmentId }),
          ...(changes.session === undefined ? {} : { requestedSession: changes.session }),
          ...(request.note === undefined ? {} : { note: request.note }),
        },
        select: requestSelect,
      });
      return presentRequest(created);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiException(409, "PROFILE_CHANGE_PENDING");
      throw error;
    }
  }

  private async assertNoOpenRequest(userId: string): Promise<void> {
    const open = await this.database.profileChangeRequest.count({
      where: { userId, status: "PENDING" },
    });
    if (open > 0) throw new ApiException(409, "PROFILE_CHANGE_PENDING");
  }
}
