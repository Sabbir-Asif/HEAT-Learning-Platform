import { courseListStatuses } from "@heat/contracts";

type CourseListStatus = (typeof courseListStatuses)[number];

export const courseStatusFilterKey = "status";

export const courseStatusFilterOptions = { [courseStatusFilterKey]: courseListStatuses };

export const courseStatusItems: ReadonlyArray<{ value: CourseListStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

export const courseStatusFromUrl = (value: string | undefined): CourseListStatus =>
  courseListStatuses.find((status) => status === value) ?? "all";
