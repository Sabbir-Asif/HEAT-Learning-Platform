import { csrfHeaderName, csrfTokenResponseSchema, studentCsrf } from "@heat/contracts";
import { execute } from "../transport";
import { registerRequestInterceptor } from "./extensions";
import type { RequestInterceptor } from "./extensions";

export interface CsrfOptions {
  cookieName?: string;
  tokenPath?: string;
  skipPaths?: ReadonlyArray<string>;
  readCookie?: (name: string) => string | undefined;
}

const defaultSkipPaths = ["/api/auth/sign-in", "/api/auth/refresh", "/api/captcha"];
const failedFetchBackoffMs = 5000;
const safeMethods: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

const pathOf = (url: string): string => url.split("?")[0] ?? url;

export function readDocumentCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    if (value === "") return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

export function createCsrfInterceptor(options: CsrfOptions = {}): RequestInterceptor {
  const cookieName = options.cookieName ?? studentCsrf.cookie;
  const tokenPath = options.tokenPath ?? studentCsrf.tokenPath;
  const skipPaths = options.skipPaths ?? defaultSkipPaths;
  const readCookie = options.readCookie ?? readDocumentCookie;
  let inFlight: Promise<string | undefined> | undefined;
  let retryAfter = 0;

  const fetchToken = async (): Promise<string | undefined> => {
    try {
      const body = await execute<unknown>(tokenPath, { method: "GET", credentials: "include" });
      const parsed = csrfTokenResponseSchema.safeParse(body);
      return parsed.success ? parsed.data.token : undefined;
    } catch {
      return undefined;
    }
  };

  const fetchTokenWithBackoff = async (): Promise<string | undefined> => {
    const token = await fetchToken();
    if (token === undefined) retryAfter = Date.now() + failedFetchBackoffMs;
    return token;
  };

  const currentToken = async (): Promise<string | undefined> => {
    const fromCookie = readCookie(cookieName);
    if (fromCookie !== undefined) return fromCookie;
    if (inFlight === undefined && Date.now() < retryAfter) return undefined;
    inFlight ??= fetchTokenWithBackoff().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };

  return async (request) => {
    const method = (request.init.method ?? "GET").toUpperCase();
    if (safeMethods.has(method) || skipPaths.includes(pathOf(request.url))) return request;
    const token = await currentToken();
    if (token === undefined) return request;
    const headers = new Headers(request.init.headers);
    headers.set(csrfHeaderName, token);
    return { ...request, init: { ...request.init, headers } };
  };
}

let uninstallCurrent: (() => void) | undefined;

export function installCsrf(options: CsrfOptions = {}): () => void {
  uninstallCurrent?.();
  const remove = registerRequestInterceptor(createCsrfInterceptor(options));
  const uninstall = () => {
    remove();
    if (uninstallCurrent === uninstall) uninstallCurrent = undefined;
  };
  uninstallCurrent = uninstall;
  return uninstall;
}
