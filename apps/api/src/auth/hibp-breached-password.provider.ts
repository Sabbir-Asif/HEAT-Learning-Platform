import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";
import { BreachedPasswordProvider } from "./breached-password.provider";

const requestTimeoutMs = 3000;

@Injectable()
export class HibpBreachedPasswordProvider extends BreachedPasswordProvider {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  async fetchRange(prefix: string): Promise<string> {
    const base = this.config.breachedPasswordRangeUrl;
    const url = base.endsWith("/") ? `${base}${prefix}` : `${base}/${prefix}`;
    const response = await fetch(url, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!response.ok) throw new Error(`Range lookup failed with status ${response.status}`);
    return response.text();
  }
}
