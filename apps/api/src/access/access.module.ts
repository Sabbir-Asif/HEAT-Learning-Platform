import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { AccessGuard } from "./access.guard";
import { EnrollmentAccessService } from "./enrollment-access.service";

@Module({
  imports: [CoreModule, AuthModule],
  providers: [EnrollmentAccessService, { provide: APP_GUARD, useClass: AccessGuard }],
  exports: [EnrollmentAccessService],
})
export class AccessModule {}
