import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { AdminAccountController } from "./admin-account.controller";
import { AdminAccountService } from "./admin-account.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminMeController } from "./admin-me.controller";
import { AdminSignInService } from "./admin-sign-in.service";

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [AdminAuthController, AdminMeController, AdminAccountController],
  providers: [AdminSignInService, AdminAccountService],
})
export class AdminAuthModule {}
