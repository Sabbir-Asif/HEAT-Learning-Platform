import { Injectable } from "@nestjs/common";
import type { EnrollmentAcceptedResponse, EnrollmentRequest } from "@heat/contracts";
import { PasswordService } from "../auth";
import { CaptchaService } from "../captcha";

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly captcha: CaptchaService,
    private readonly passwords: PasswordService,
  ) {}

  async submit(request: EnrollmentRequest): Promise<EnrollmentAcceptedResponse> {
    await this.captcha.verify(request.captchaId, request.captchaAnswer);
    await this.passwords.assertNotBreached(request.password);
    return { accepted: true };
  }
}
