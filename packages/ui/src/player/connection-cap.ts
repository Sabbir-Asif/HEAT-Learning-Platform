export type AutoResolutionCap = "480p" | "720p";

export interface ConnectionInfo {
  saveData?: boolean;
  effectiveType?: string;
}

const constrainedTypes = new Set(["slow-2g", "2g", "3g"]);

export const selectAutoResolutionCap = (connection?: ConnectionInfo | null): AutoResolutionCap => {
  if (!connection) return "720p";
  if (connection.saveData === true) return "480p";
  if (connection.effectiveType && constrainedTypes.has(connection.effectiveType)) return "480p";
  return "720p";
};

export const readConnection = (): ConnectionInfo | null => {
  if (typeof navigator === "undefined") return null;
  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
  return connection ?? null;
};
