import { defaultNextPath, safeNextPath } from "./next-path";

export const signInPath = "/sign-in";
export const accountPath = "/account";

export const signInLocation = (next: string): string => {
  const safe = safeNextPath(next);
  return safe === defaultNextPath && next !== defaultNextPath
    ? signInPath
    : `${signInPath}?next=${encodeURIComponent(safe)}`;
};
