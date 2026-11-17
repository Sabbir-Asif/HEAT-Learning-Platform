import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { AuditModule } from "../audit";
import { CoreModule } from "../core";
import { DirectoryModule } from "../directory";
import { MediaModule } from "../media";
import { RateLimitModule } from "../rate-limit";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";
import { PasswordChangeController } from "./password-change.controller";
import { PasswordChangeService } from "./password-change.service";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [CoreModule, AuthModule, AuditModule, DirectoryModule, MediaModule, RateLimitModule],
  controllers: [MeController, ProfileController, PasswordChangeController],
  providers: [MeService, ProfileService, PasswordChangeService],
  exports: [MeService],
})
export class MeModule {}
