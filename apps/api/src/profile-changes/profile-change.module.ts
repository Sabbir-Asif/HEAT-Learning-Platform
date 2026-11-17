import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { DirectoryModule } from "../directory";
import { NotificationsModule } from "../notifications";
import { ProfileChangeAdminController } from "./profile-change-admin.controller";
import { ProfileChangeAdminService } from "./profile-change-admin.service";
import { ProfileChangeController } from "./profile-change.controller";
import { ProfileChangeService } from "./profile-change.service";

@Module({
  imports: [CoreModule, AuditModule, AuthModule, DirectoryModule, NotificationsModule],
  controllers: [ProfileChangeController, ProfileChangeAdminController],
  providers: [ProfileChangeService, ProfileChangeAdminService],
})
export class ProfileChangesModule {}
