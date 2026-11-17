import { Inject, Injectable, Logger } from "@nestjs/common";
import { revalidatePath, revalidateSecretHeader } from "@heat/contracts";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";

export { courseCacheTag, frontPageCacheTag, landingCacheTag } from "@heat/contracts";

export interface PublicRevalidation {
  revalidate(cacheTags: string[]): Promise<void>;
}

export const PUBLIC_REVALIDATION = Symbol("PUBLIC_REVALIDATION");

export const revalidationTimeoutMs = 3000;

@Injectable()
export class HttpPublicRevalidation implements PublicRevalidation {
  private readonly logger = new Logger(HttpPublicRevalidation.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async revalidate(cacheTags: string[]): Promise<void> {
    const tags = [...new Set(cacheTags)];
    const { url, secret } = this.config.revalidation;
    if (tags.length === 0) return;
    if (secret === undefined) {
      this.logger.warn("REVALIDATE_SECRET is not set, so public pages were not refreshed");
      return;
    }
    const response = await fetch(new URL(revalidatePath, url), {
      method: "POST",
      headers: { "content-type": "application/json", [revalidateSecretHeader]: secret },
      body: JSON.stringify({ tags }),
      redirect: "manual",
      signal: AbortSignal.timeout(revalidationTimeoutMs),
    });
    if (!response.ok) throw new Error(`Revalidation answered ${response.status}`);
  }
}
