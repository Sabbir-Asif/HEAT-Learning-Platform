import { resourceListStatuses } from "@heat/contracts";

type ResourceListStatus = (typeof resourceListStatuses)[number];

export const resourceStatusFilterKey = "status";

export const resourceStatusFilterOptions = { [resourceStatusFilterKey]: resourceListStatuses };

export const resourceStatusItems: ReadonlyArray<{ value: ResourceListStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Draft" },
];

export const resourceStatusFromUrl = (value: string | undefined): ResourceListStatus =>
  resourceListStatuses.find((status) => status === value) ?? "all";

export const resourceKindItems = [
  { value: "file", label: "File" },
  { value: "link", label: "Link" },
] as const;

export const noCourseValue = "none";
