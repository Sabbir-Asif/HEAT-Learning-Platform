import { isApiError } from "../errors";
import { execute } from "../transport";
import { setUnauthorizedHandler } from "./extensions";
import type { UnauthorizedHandler } from "./extensions";

export interface SessionRefreshOptions {
  refreshPath?: string;
  skipPaths?: ReadonlyArray<string>;
  onExpired?: () => void;
}

const defaultRefreshPath = "/api/auth/refresh";
const defaultSkipPaths = ["/api/auth/sign-in", "/api/auth/refresh"];

const pathOf = (url: string): string => url.split("?")[0] ?? url;

export function createSessionRefresh(options: SessionRefreshOptions = {}): UnauthorizedHandler {
  const refreshPath = options.refreshPath ?? defaultRefreshPath;
  const skipPaths = options.skipPaths ?? defaultSkipPaths;
  let inFlight: Promise<boolean> | undefined;

  const refresh = async (): Promise<boolean> => {
    try {
      await execute<void>(refreshPath, { method: "POST", credentials: "include" });
      return true;
    } catch (error) {
      if (isApiError(error) && error.status === 401) options.onExpired?.();
      return false;
    }
  };

  return (_error, { url }) => {
    if (skipPaths.includes(pathOf(url))) return false;
    inFlight ??= refresh().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}

export function installSessionRefresh(options: SessionRefreshOptions = {}): () => void {
  setUnauthorizedHandler(createSessionRefresh(options));
  return () => setUnauthorizedHandler(undefined);
}
