import { Inject, Injectable } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";

@Injectable()
export class DepartmentOfferingService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async assertDepartmentOfferable(
    departmentId: string,
    client: Pick<HeatClient, "department"> = this.database,
  ): Promise<void> {
    const offered = await client.department.findFirst({
      where: {
        id: departmentId,
        archivedAt: null,
        universityFaculty: { university: { archivedAt: null }, faculty: { archivedAt: null } },
      },
      select: { id: true },
    });
    if (offered === null) {
      throw new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
        { path: "departmentId", code: "invalid_value" },
      ]);
    }
  }
}
