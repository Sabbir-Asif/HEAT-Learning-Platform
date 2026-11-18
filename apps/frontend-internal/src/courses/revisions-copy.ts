import type { CourseRevisionItemDto } from "@heat/api-client";

export const revisionsLoadFailedMessage = "The revisions could not be loaded.";

export const cloneRevisionTitle = "Clone into a new draft?";

export const cloneRevisionDescription =
  "The latest published revision is copied into a new draft you can edit. Enrolled students keep the content they enrolled in.";

export const publishRevisionTitle = "Publish this revision?";

export const publishRevisionDescription =
  "New approvals will use this revision. Students who are already enrolled keep the revision they started with.";

export const revisionLockedNote =
  "A locked revision cannot be edited. Clone it to make larger changes.";

export const revisionEnrollmentLabel = (count: number): string =>
  count === 1 ? "1 student" : `${count} students`;

export const revisionLabel = (revision: Pick<CourseRevisionItemDto, "number">): string =>
  `Revision ${revision.number}`;

export const cloneRevisionFailedMessage = (code: string | undefined): string =>
  code === "COURSE_REVISION_DRAFT_EXISTS"
    ? "A draft revision already exists. Publish it before cloning again."
    : "The revision could not be cloned. Try again.";

export const publishRevisionFailedMessage = (failures: readonly string[]): string =>
  failures.length === 0
    ? "The revision could not be published. Try again."
    : `This revision is not ready to publish. ${failures.join(" ")}`;

export const canCloneRevisions = (revisions: readonly CourseRevisionItemDto[]): boolean =>
  revisions.length > 0 && revisions.every((revision) => revision.status === "PUBLISHED");

export const draftRevisionOf = (
  revisions: readonly CourseRevisionItemDto[],
): CourseRevisionItemDto | null =>
  revisions.find((revision) => revision.status === "DRAFT") ?? null;

export const revisionSnapshotLoadFailedMessage = "The revision could not be loaded.";

export const revisionSnapshotNotice = (
  status: CourseRevisionItemDto["status"],
  students: number,
): string => {
  if (students > 0) {
    const who = students === 1 ? "1 student is" : `${students} students are`;
    return `${who} enrolled on this revision. They keep this exact content, even after newer revisions are published.`;
  }
  return status === "DRAFT"
    ? "No students are enrolled on this draft. Students are enrolled on a revision once it is published and they are approved."
    : "No students are enrolled on this revision. New approvals use the newest published revision.";
};

export const revisionStudentsOverflow = (shown: number, total: number): string =>
  `Showing the first ${shown} of ${total} students.`;

export const revisionModuleCountLabel = (count: number): string =>
  count === 1 ? "1 module" : `${count} modules`;

export const deleteRevisionTitle = "Delete this draft revision?";

export const deleteRevisionDescription =
  "The draft and everything in it is deleted. Published revisions and enrolled students are not affected. This cannot be undone.";

export const deleteRevisionFailedMessage = (code: string | undefined): string =>
  code === "COURSE_REVISION_NOT_DRAFT"
    ? "Only the latest draft revision, with no students enrolled, can be deleted."
    : code === "COURSE_REVISION_REQUIRED"
      ? "A course needs at least one revision."
      : "The revision could not be deleted. Try again.";

export const canDeleteRevision = (
  revision: Pick<CourseRevisionItemDto, "status" | "current" | "enrollmentCount">,
  revisionCount: number,
): boolean =>
  revision.status === "DRAFT" &&
  revision.current &&
  revision.enrollmentCount === 0 &&
  revisionCount > 1;
