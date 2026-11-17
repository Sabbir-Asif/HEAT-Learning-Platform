import { revalidatePath, revalidateSecretHeader } from "@heat/contracts";
import type { NewsRevalidation } from "./news-publication";

export const revalidationTimeoutMs = 3000;

export class HttpNewsRevalidation implements NewsRevalidation {
  constructor(private readonly target: { url: string; secret: string | undefined }) {}

  async revalidate(tags: string[]): Promise<void> {
    const { url, secret } = this.target;
    if (secret === undefined) throw new Error("REVALIDATE_SECRET is not set");
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
