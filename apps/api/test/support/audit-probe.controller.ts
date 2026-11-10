import {
  Body,
  Controller,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Param,
  Post,
} from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { Audience, Roles } from "../../src/access";
import { Audited, AuditService } from "../../src/audit";
import { DATABASE } from "../../src/core";

interface ProbeBody {
  fail?: boolean;
  silent?: boolean;
}

@Controller("probe/audited")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AuditProbeController {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
  ) {}

  @Post(":id")
  @HttpCode(200)
  @Audited({ action: "probe.update", entity: "User" })
  async update(@Param("id") id: string, @Body() body: ProbeBody): Promise<{ ok: true }> {
    const client = this.audit.client(this.database);
    const before = await client.user.findUniqueOrThrow({ where: { id } });
    const after = await client.user.update({ where: { id }, data: { mustChangePassword: true } });
    if (body.silent !== true) this.audit.capture({ entityId: id, before, after });
    if (body.fail === true) throw new InternalServerErrorException();
    return { ok: true };
  }
}
