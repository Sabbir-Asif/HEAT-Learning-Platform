import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { MeModule } from "../me/me.module";
import { StudentAuthController } from "./student-auth.controller";
import { StudentSignInService } from "./student-sign-in.service";

@Module({
  imports: [CoreModule, AuthModule, MeModule],
  controllers: [StudentAuthController],
  providers: [StudentSignInService],
})
export class StudentAuthModule {}
