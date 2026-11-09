import { createElement } from "react";
import { cn } from "../lib/utils";
import type { LogoSource } from "./types";

type ThemedLogoProps = LogoSource & {
  className?: string;
  tone?: "auto" | "inverse";
  eager?: boolean;
};

function logoImage(src: string, alt: string, className: string, eager: boolean) {
  return createElement("img", {
    "data-slot": "themed-logo",
    src,
    alt,
    className,
    loading: eager ? "eager" : "lazy",
  });
}

function ThemedLogo({
  src,
  darkSrc,
  alt,
  className,
  tone = "auto",
  eager = false,
}: ThemedLogoProps) {
  if (tone === "inverse") {
    return logoImage(darkSrc, alt, cn("h-8 w-auto", className), eager);
  }
  return (
    <>
      {logoImage(src, alt, cn("h-8 w-auto dark:hidden", className), eager)}
      {logoImage(darkSrc, alt, cn("hidden h-8 w-auto dark:block", className), false)}
    </>
  );
}

export { ThemedLogo };
export type { ThemedLogoProps };
