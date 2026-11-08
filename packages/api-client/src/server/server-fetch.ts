import "server-only";
import { headers } from "next/headers";
import { execute, toApiPath } from "../transport";

export class ApiClientConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiClientConfigError";
  }
}

export interface ServerFetchOptions extends RequestInit {
  forwardCookies?: boolean;
}

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

  const hasCacheChoice = init.cache !== undefined || "next" in init;
  return execute<T>(target.toString(), {
    ...init,
    headers: outgoing,
    redirect: "manual",
    ...(hasCacheChoice ? {} : { cache: "no-store" }),
  });
}
