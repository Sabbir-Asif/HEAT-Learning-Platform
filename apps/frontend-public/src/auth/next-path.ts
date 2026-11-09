const origin = "http://same-site.invalid";
const blockedPrefixes = ["/auth/refresh", "/sign-in"];

export const defaultNextPath = "/dashboard";

const hasControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
};

export function safeNextPath(
  raw: string | null | undefined,
  fallback: string = defaultNextPath,
): string {
  if (typeof raw !== "string" || raw === "") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  if (hasControlCharacter(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== origin) return fallback;
  if (
    blockedPrefixes.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    )
  ) {
    return fallback;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
