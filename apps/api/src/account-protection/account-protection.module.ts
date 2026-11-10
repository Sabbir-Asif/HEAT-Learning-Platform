import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RegistrationPolicyService } from "./registration-policy.service";
import { ResponseTiming } from "./response-timing";
import { VerificationSessionService } from "./verification-session.service";

@Module({
  imports: [CoreModule, AuditModule, AuthModule],
  providers: [RegistrationPolicyService, VerificationSessionService, ResponseTiming],
  exports: [RegistrationPolicyService, VerificationSessionService, ResponseTiming],
})
export class AccountProtectionModule {}
