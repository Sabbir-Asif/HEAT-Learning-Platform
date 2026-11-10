import { directoryStatuses } from "@heat/contracts";
import type { DirectoryStatus } from "@heat/contracts";

export const statusFilterKey = "status";

export const statusFilterOptions = { [statusFilterKey]: directoryStatuses };

export const directoryStatusItems: ReadonlyArray<{ value: DirectoryStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

export const statusFromUrl = (value: string | undefined): DirectoryStatus =>
  directoryStatuses.find((status) => status === value) ?? "active";

export const archiveFailedMessage = (name: string): string =>
  `${name} could not be archived. Try again.`;

export const restoreFailedMessage = (name: string): string =>
  `${name} could not be restored. Try again.`;
