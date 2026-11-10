import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { captchaFieldsSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";
import { Public } from "../../src/auth";
import { CaptchaService } from "../../src/captcha";

class CaptchaProbeDto extends createZodDto(captchaFieldsSchema) {}

@Controller("captcha-probe")
export class CaptchaProbeController {
  constructor(private readonly captcha: CaptchaService) {}

  @Public()
  @Post()
  @HttpCode(200)
  async protectedAction(@Body() body: CaptchaProbeDto): Promise<{ ok: true }> {
    await this.captcha.verify(body.captchaId, body.captchaAnswer);
    return { ok: true };
  }
}
