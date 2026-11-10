import { Module } from "@nestjs/common";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { CAPTCHA_ENTROPY, cryptoEntropy } from "./captcha-entropy";
import { CaptchaController } from "./captcha.controller";
import { CaptchaService } from "./captcha.service";
import { CaptchaStore } from "./captcha.store";
import { RedisCaptchaStore } from "./redis-captcha.store";

@Module({
  imports: [CoreModule, RateLimitModule],
  controllers: [CaptchaController],
  providers: [
    CaptchaService,
    { provide: CAPTCHA_ENTROPY, useValue: cryptoEntropy },
    { provide: CaptchaStore, useClass: RedisCaptchaStore },
  ],
  exports: [CaptchaService],
})
export class CaptchaModule {}
