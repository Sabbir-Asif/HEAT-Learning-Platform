import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { CertificateVerifyController } from "./certificate-verify.controller";
import { CertificateAdminService } from "./certificate-admin.service";
import { AdminCertificatesController } from "./admin-certificates.controller";
import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";
import { MeCertificatesController } from "./me-certificates.controller";

@Module({
  imports: [CoreModule, AuthModule, AuditModule, RateLimitModule],
  controllers: [
    CertificatesController,
    CertificateVerifyController,
    AdminCertificatesController,
    MeCertificatesController,
  ],
  providers: [CertificatesService, CertificateAdminService],
})
export class CertificatesModule {}
