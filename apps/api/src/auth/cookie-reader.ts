export type CookieHeader = string | string[] | undefined;

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const readCookie = (header: CookieHeader, name: string): string | undefined => {
  const raw = Array.isArray(header) ? header.join("; ") : header;
  if (raw === undefined) return undefined;
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    const unquoted = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
    return unquoted === "" ? undefined : decode(unquoted);
  }
  return undefined;
};
