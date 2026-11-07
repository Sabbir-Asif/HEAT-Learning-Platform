import "server-only";
import { headers } from "next/headers";
import { execute, toApiPath } from "../transport";

/** `API_INTERNAL_URL` is missing or unusable. Raised on first use, never at import time. */
export class ApiClientConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiClientConfigError";
  }
}

export interface ServerFetchOptions extends RequestInit {
  /**
   * Forward the incoming request's `Cookie` header (default). Set `false` inside `'use cache'`
   * functions, which cannot read request headers and must not hold per-user data.
   */
  forwardCookies?: boolean;
}

/** The internal API origin. No fallback: a wrong host in production must fail loudly. */
function internalOrigin(): string {
  const value = process.env.API_INTERNAL_URL?.trim();
  if (!value) {
    throw new ApiClientConfigError(
      "API_INTERNAL_URL is not set. Set it to the API's address on the internal network, for example http://api:4000.",
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiClientConfigError("API_INTERNAL_URL is not a valid URL.");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.pathname !== "/") {
    throw new ApiClientConfigError(
      "API_INTERNAL_URL must be an http(s) origin without a path, such as http://api:4000.",
    );
  }
  return url.origin;
}

/**
 * The fetcher for Server Components, Route Handlers and the data access layer. It calls the API on
 * the internal network and forwards the incoming `Cookie` header, and only that header. Redirects are
 * not followed, `Set-Cookie` from the API is not passed on, and the response is uncached unless the
 * caller chooses a cache option. Failures are thrown as `ApiError`, the same as in the browser.
 */
export async function serverFetch<T>(url: string, options: ServerFetchOptions = {}): Promise<T> {
  const { forwardCookies = true, ...init } = options;
  const origin = internalOrigin();
  const target = new URL(toApiPath(url), origin);

  const outgoing = new Headers(init.headers);
  outgoing.delete("cookie");
  if (forwardCookies) {
    const cookie = (await headers()).get("cookie");
    if (cookie) outgoing.set("cookie", cookie);
  }

  // `next` is Next.js' own fetch option (revalidate, tags); with one of them the cache choice is theirs.
  const hasCacheChoice = init.cache !== undefined || "next" in init;
  return execute<T>(target.toString(), {
    ...init,
    headers: outgoing,
    redirect: "manual",
    ...(hasCacheChoice ? {} : { cache: "no-store" }),
  });
}
