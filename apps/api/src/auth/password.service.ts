import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { argon2id, hash, needsRehash, verify } from "argon2";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";
import { ApiException } from "../http/api-exception";
import { BreachedPasswordProvider } from "./breached-password.provider";

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly breached: BreachedPasswordProvider,
  ) {}

  hash(password: string): Promise<string> {
    return hash(password, { type: argon2id, ...this.config.argon2 });
  }

  async verify(digest: string, password: string): Promise<boolean> {
    try {
      return await verify(digest, password);
    } catch {
      return false;
    }
  }

  needsRehash(digest: string): boolean {
    return needsRehash(digest, this.config.argon2);
  }

  async assertNotBreached(password: string): Promise<void> {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    let body: string;
    try {
      body = await this.breached.fetchRange(prefix);
    } catch {
      this.logger.warn("Breached password lookup unavailable, continuing without it");
      return;
    }
    if (appearsInRange(body, suffix)) throw new ApiException(400, "PASSWORD_BREACHED");
  }

  async hashChecked(password: string): Promise<string> {
    await this.assertNotBreached(password);
    return this.hash(password);
  }
}

const appearsInRange = (body: string, suffix: string): boolean =>
  body.split(/\r?\n/).some((line) => {
    const [candidate, count] = line.trim().split(":");
    return candidate?.toUpperCase() === suffix && Number(count) > 0;
  });
