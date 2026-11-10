import { Module } from "@nestjs/common";
import { CoreModule } from "../core";
import { AccessTokenService } from "./access-token.service";
import { BreachedPasswordProvider } from "./breached-password.provider";
import { CLAIM_POLLING, defaultClaimPolling } from "./claim-polling";
import { CookieWriter } from "./cookie-writer";
import { CsrfTokenService } from "./csrf-token.service";
import { HibpBreachedPasswordProvider } from "./hibp-breached-password.provider";
import { PasswordService } from "./password.service";
import { PrismaSessionStore } from "./prisma-session.store";
import { RedisRotationClaimStore } from "./redis-rotation-claim.store";
import { RotationClaimStore } from "./rotation-claim.store";
import { SessionService } from "./session.service";
import { SessionStore } from "./session.store";

@Module({
  imports: [CoreModule],
  providers: [
    AccessTokenService,
    CookieWriter,
    CsrfTokenService,
    PasswordService,
    SessionService,
    { provide: CLAIM_POLLING, useValue: defaultClaimPolling },
    { provide: BreachedPasswordProvider, useClass: HibpBreachedPasswordProvider },
    { provide: SessionStore, useClass: PrismaSessionStore },
    { provide: RotationClaimStore, useClass: RedisRotationClaimStore },
  ],
  exports: [AccessTokenService, CookieWriter, CsrfTokenService, PasswordService, SessionService],
})
export class AuthModule {}
