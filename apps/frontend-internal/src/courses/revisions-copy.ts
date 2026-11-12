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
