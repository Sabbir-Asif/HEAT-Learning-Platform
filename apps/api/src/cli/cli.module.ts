import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RecoverSuperAdminService } from "./recover-super-admin.service";

@Module({
  imports: [CoreModule, AuthModule, AuditModule],
  providers: [RecoverSuperAdminService],
  exports: [RecoverSuperAdminService],
})
export class CliModule {}
