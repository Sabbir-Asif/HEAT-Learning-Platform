import { Inject, Injectable } from "@nestjs/common";
import type {
  AdminProfileChangeItem,
  AdminProfileChangeListResponse,
  ProfileChangeDecision,
  ProfileChangeQuery,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { DepartmentOfferingService } from "../directory";
import { ApiException } from "../http/api-exception";
import { adminRequestSelect, presentAdminRequest } from "./profile-change-presenter";
import { assertStoredNameIsEnglish } from "./profile-change-rules";

@Injectable()
export class ProfileChangeAdminService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly departments: DepartmentOfferingService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ProfileChangeQuery): Promise<AdminProfileChangeListResponse> {
    const where = { status: query.status, user: { deletedAt: null } };
    const [rows, total] = await Promise.all([
      this.database.profileChangeRequest.findMany({
        where,
        orderBy: [{ createdAt: query.status === "PENDING" ? "asc" : "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: adminRequestSelect,
      }),
      this.database.profileChangeRequest.count({ where }),
    ]);
    const items = rows
      .map(presentAdminRequest)
      .filter((item): item is AdminProfileChangeItem => item !== null);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async approve(id: string, adminId: string): Promise<ProfileChangeDecision> {
    const db = this.audit.client(this.database);
    const request = await this.pending(id);
    const profile = request.user.profile;
    if (profile === null) throw new ApiException(404, "NOT_FOUND");
    if (request.requestedName !== null) assertStoredNameIsEnglish(request.requestedName);
    if (request.requestedDepartmentId !== null) {
      await this.departments.assertDepartmentOfferable(request.requestedDepartmentId, db);
    }
    const now = this.clock.now();
    await this.claim(id, "APPROVED", adminId, now);
    const next = {
      ...(request.requestedName === null ? {} : { name: request.requestedName }),
      ...(request.requestedDepartmentId === null
        ? {}
        : { departmentId: request.requestedDepartmentId }),
      ...(request.requestedSession === null ? {} : { session: request.requestedSession }),
    };
    await db.studentProfile.update({ where: { id: profile.id }, data: next });
    await db.notification.create({
      data: { userId: request.user.id, type: "PROFILE_CHANGE_APPROVED", data: { requestId: id } },
    });
    this.audit.capture({
      entityId: id,
      before: {
        userId: request.user.id,
        name: profile.name,
        departmentId: profile.department.id,
        departmentName: profile.department.name,
        cohort: profile.session,
      },
      after: {
        userId: request.user.id,
        name: request.requestedName ?? profile.name,
        departmentId: request.requestedDepartment?.id ?? profile.department.id,
        departmentName: request.requestedDepartment?.name ?? profile.department.name,
        cohort: request.requestedSession ?? profile.session,
      },
    });
    return { id, status: "APPROVED", decidedAt: now.toISOString() };
  }

  async reject(id: string, adminId: string, reason: string): Promise<ProfileChangeDecision> {
    const db = this.audit.client(this.database);
    const request = await this.pending(id);
    const now = this.clock.now();
    await this.claim(id, "REJECTED", adminId, now, reason);
    await db.notification.create({
      data: {
        userId: request.user.id,
        type: "PROFILE_CHANGE_REJECTED",
        data: { requestId: id, reason },
      },
    });
    this.audit.capture({
      entityId: id,
      before: { userId: request.user.id, status: "PENDING" },
      after: { userId: request.user.id, status: "REJECTED", reason },
    });
    return { id, status: "REJECTED", decidedAt: now.toISOString() };
  }

  private async pending(id: string) {
    const db = this.audit.client(this.database);
    const request = await db.profileChangeRequest.findFirst({
      where: { id },
      select: {
        status: true,
        requestedName: true,
        requestedDepartmentId: true,
        requestedSession: true,
        requestedDepartment: { select: { id: true, name: true } },
        user: {
          select: {
            id: true,
            deletedAt: true,
            profile: {
              select: {
                id: true,
                name: true,
                session: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (request === null || request.user.deletedAt !== null) {
      throw new ApiException(404, "NOT_FOUND");
    }
    if (request.status !== "PENDING") throw new ApiException(409, "PROFILE_CHANGE_NOT_PENDING");
    return request;
  }

  private async claim(
    id: string,
    status: "APPROVED" | "REJECTED",
    adminId: string,
    decidedAt: Date,
    reason?: string,
  ): Promise<void> {
    const db = this.audit.client(this.database);
    const claimed = await db.profileChangeRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status,
        decidedById: adminId,
        decidedAt,
        ...(reason === undefined ? {} : { reason }),
      },
    });
    if (claimed.count === 0) throw new ApiException(409, "PROFILE_CHANGE_NOT_PENDING");
  }
}
