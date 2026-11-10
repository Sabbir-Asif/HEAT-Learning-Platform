const maxValueLength = 40;

const show = (value: unknown): string => {
  if (value === null || value === undefined) return "none";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > maxValueLength ? `${text.slice(0, maxValueLength)}...` : text;
};

export const describeChange = (
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string => {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return keys
    .filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
    .map((key) =>
      before === null || !(key in before)
        ? `${key}: ${show(after?.[key])}`
        : `${key}: ${show(before[key])} to ${show(after?.[key])}`,
    )
    .join(", ");
};

export const actorLabel = (actorEmail: string | null, actorId: string | null): string =>
  actorEmail ?? (actorId === null ? "System" : "Removed account");
