const dhakaOffsetMilliseconds = 6 * 60 * 60 * 1000;

export const studentExportColumns = [
  "Name",
  "Email",
  "University",
  "Faculty",
  "Department",
  "Session",
  "Course",
  "Status",
  "Requested (Asia/Dhaka)",
  "Approved (Asia/Dhaka)",
  "Completed (Asia/Dhaka)",
  "Progress",
] as const;

export const formatDhakaDateTime = (date: Date | null): string =>
  date === null
    ? ""
    : new Date(date.getTime() + dhakaOffsetMilliseconds)
        .toISOString()
        .slice(0, 16)
        .replace("T", " ");

export const progressSummary = (completed: number, total: number): string =>
  `${completed} of ${total} modules`;
