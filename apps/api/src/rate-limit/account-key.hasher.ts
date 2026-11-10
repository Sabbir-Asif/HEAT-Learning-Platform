import { createHmac } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";

const keyPurpose = "heat:rate-limit:account-key:v1";

@Injectable()
export class AccountKeyHasher {
  private readonly subkey: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.subkey = createHmac("sha256", config.auth.accessSecret).update(keyPurpose).digest();
  }

  forEmail(email: string): string {
    return this.digest(`email:${email.trim().toLowerCase()}`);
  }

  forUser(userId: string): string {
    return this.digest(`user:${userId}`);
  }

  private digest(value: string): string {
    return createHmac("sha256", this.subkey).update(value).digest("hex");
  }
}
