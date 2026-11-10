import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { AuditLogListQueryDto, AuditLogListResponseDto } from "./audit-log.dto";
import { AuditLogService } from "./audit-log.service";

@ApiTags("audit-log")
@Controller("admin/audit-log")
@Audience("admin")
@Roles("SUPER_ADMIN")
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @ApiOkResponse({ type: AuditLogListResponseDto })
  list(@Query() query: AuditLogListQueryDto): Promise<AuditLogListResponseDto> {
    return this.auditLog.list(query);
  }
}
