import { createElement, type ReactElement } from "react";
import type { ShellLink } from "./types";

export function linkElement(
  link: ShellLink | undefined,
  props: Record<string, unknown> & { href: string },
): ReactElement {
  return createElement(link ?? "a", props);
}
