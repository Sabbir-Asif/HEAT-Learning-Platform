const targetMentionsEmail = (target: unknown): boolean => {
  if (target === undefined || target === null) return true;
  const names = Array.isArray(target) ? target : [target];
  return names.some((name) => typeof name === "string" && name.toLowerCase().includes("email"));
};

export const isActiveEmailConflict = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } };
  return code === "P2002" && targetMentionsEmail(meta?.target);
};
