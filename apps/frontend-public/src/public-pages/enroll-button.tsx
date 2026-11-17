import { Button } from "@heat/ui";
import Link from "next/link";
import { enrollHref } from "./links";

export function EnrollButton({
  courseSlug,
  courseTitle,
}: {
  courseSlug: string;
  courseTitle: string;
}) {
  return (
    <Button nativeButton={false} render={<Link href={enrollHref(courseSlug)} />}>
      Enroll
      <span className="sr-only"> in {courseTitle}</span>
    </Button>
  );
}
