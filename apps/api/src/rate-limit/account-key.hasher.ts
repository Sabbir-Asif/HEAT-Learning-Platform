import { createHmac } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";

@Injectable()
export class AccountKeyHasher {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  forEmail(email: string): string {
    return this.digest(`email:${email.trim().toLowerCase()}`);
  }

  forUser(userId: string): string {
    return this.digest(`user:${userId}`);
  }

  private digest(value: string): string {
    return createHmac("sha256", this.config.auth.accessSecret).update(value).digest("hex");
  }
}
