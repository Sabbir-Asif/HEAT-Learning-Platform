import { newsListStatuses } from "@heat/contracts";

type NewsListStatus = (typeof newsListStatuses)[number];

export const newsStatusFilterKey = "status";

export const newsStatusFilterOptions = { [newsStatusFilterKey]: newsListStatuses };

export const newsStatusItems: ReadonlyArray<{ value: NewsListStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
];

export const newsStatusFromUrl = (value: string | undefined): NewsListStatus =>
  newsListStatuses.find((status) => status === value) ?? "all";

export const newsEditorStatusItems = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
] as const;
