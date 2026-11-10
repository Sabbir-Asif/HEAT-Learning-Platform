import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { CoreModule } from "../core";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditService } from "./audit.service";

@Module({
  imports: [CoreModule],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
