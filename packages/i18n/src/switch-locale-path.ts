import { isLocale, type Locale } from "./locale";

function isUnsafe(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code === 92 || code <= 31 || code === 127) return true;
  }
  return false;
}

function isDotSegment(segment: string): boolean {
  const decoded = segment.toLowerCase().replaceAll("%2e", ".");
  return decoded === "." || decoded === "..";
}

export function switchLocalePath(path: string, target: Locale): string {
  const suffixStart = path.search(/[?#]/);
  const pathname = suffixStart === -1 ? path : path.slice(0, suffixStart);
  const suffix =
    suffixStart === -1 || isUnsafe(path.slice(suffixStart)) ? "" : path.slice(suffixStart);
  if (!pathname.startsWith("/") || isUnsafe(pathname)) return `/${target}`;
  const segments = pathname
    .split("/")
    .filter((segment) => segment !== "" && !isDotSegment(segment));
  if (isLocale(segments[0])) segments.shift();
  return `/${[target, ...segments].join("/")}${suffix}`;
}
