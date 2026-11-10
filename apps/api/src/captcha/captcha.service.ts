import { createHmac, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { captchaMaxTries, captchaTtlSeconds } from "@heat/contracts";
import type { CaptchaResponse } from "@heat/contracts";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";
import { ApiException } from "../http/api-exception";
import { CAPTCHA_ENTROPY } from "./captcha-entropy";
import type { CaptchaEntropy } from "./captcha-entropy";
import { renderCaptchaSvg } from "./captcha-image";
import { generateCaptchaText, normaliseAnswer } from "./captcha-text";
import { CaptchaStore } from "./captcha.store";

const keyPurpose = "heat:captcha:answer:v1";

@Injectable()
export class CaptchaService {
  private readonly hashKey: Buffer;

  constructor(
    private readonly store: CaptchaStore,
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(CAPTCHA_ENTROPY) private readonly entropy: CaptchaEntropy,
  ) {
    this.hashKey = createHmac("sha256", config.auth.accessSecret).update(keyPurpose).digest();
  }

  async issue(replaces?: string): Promise<CaptchaResponse> {
    if (replaces !== undefined) await this.store.remove(replaces);
    const id = randomUUID();
    const text = generateCaptchaText(this.entropy);
    await this.store.save(id, this.hashAnswer(id, text), captchaTtlSeconds);
    return {
      id,
      svg: renderCaptchaSvg(text, this.entropy),
      expiresInSeconds: captchaTtlSeconds,
    };
  }

  async verify(id: string, answer: string): Promise<void> {
    const outcome = await this.store.attempt(
      id,
      this.hashAnswer(id, normaliseAnswer(answer)),
      captchaMaxTries,
    );
    if (outcome === "passed") return;
    throw new ApiException(400, outcome === "wrong" ? "CAPTCHA_INVALID" : "CAPTCHA_EXPIRED");
  }

  private hashAnswer(id: string, normalised: string): string {
    return createHmac("sha256", this.hashKey).update(`${id}:${normalised}`).digest("hex");
  }
}
