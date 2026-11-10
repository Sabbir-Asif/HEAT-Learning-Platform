import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { CoreModule } from "../core";
import { AuditLogController } from "./audit-log.controller";
import { AuditLogService } from "./audit-log.service";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditService } from "./audit.service";

@Module({
  imports: [CoreModule],
  controllers: [AuditLogController],
  providers: [
    AuditService,
    AuditLogService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
