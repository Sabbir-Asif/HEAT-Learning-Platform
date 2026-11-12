export interface PublicRevalidation {
  revalidate(cacheTags: string[]): Promise<void>;
}

export const PUBLIC_REVALIDATION = Symbol("PUBLIC_REVALIDATION");

export const frontPageCacheTag = "front-page";

export class NoopPublicRevalidation implements PublicRevalidation {
  revalidate(): Promise<void> {
    return Promise.resolve();
  }
}

export const landingCacheTag = "landing";
