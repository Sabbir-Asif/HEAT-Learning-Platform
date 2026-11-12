"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void): (() => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

const snapshot = (): boolean => document.visibilityState === "visible";

const serverSnapshot = (): boolean => true;

export const usePageVisible = (): boolean =>
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);
