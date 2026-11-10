import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { AdminInvitationController } from "./admin-invitation.controller";
import { AdminInvitationService } from "./admin-invitation.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

@Module({
  imports: [CoreModule, AuditModule, AuthModule, RateLimitModule],
  controllers: [AdminUsersController, AdminInvitationController],
  providers: [AdminUsersService, AdminInvitationService],
  exports: [AdminUsersService],
})
export class AdminManagementModule {}
