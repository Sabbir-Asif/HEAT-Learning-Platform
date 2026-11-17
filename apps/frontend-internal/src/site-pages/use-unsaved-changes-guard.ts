"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const internalTarget = (anchor: HTMLAnchorElement): string | null => {
  const target = new URL(anchor.href, window.location.href);
  if (target.origin !== window.location.origin) return null;
  const path = `${target.pathname}${target.search}${target.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return path === current ? null : path;
};

const isPlainLeftClick = (event: MouseEvent): boolean =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const intercept = (event: MouseEvent) => {
      if (!isPlainLeftClick(event)) return;
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target !== "" && anchor.target !== "_self") return;
      const path = internalTarget(anchor);
      if (path === null) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(path);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);

  const stay = useCallback(() => setPending(null), []);

  const leave = useCallback(() => {
    if (pending === null) return;
    setPending(null);
    router.push(pending);
  }, [pending, router]);

  return { confirming: pending !== null, stay, leave };
}
