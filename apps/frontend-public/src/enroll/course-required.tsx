import { Button, EmptyState, PageHeader } from "@heat/ui";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";

export function CourseRequired() {
  return (
    <>
      <PageHeader title="Enroll" />
      <EmptyState
        icon={BookOpenIcon}
        title="Choose a course to enroll in"
        description="Open a course and use its Enroll button."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/#courses" />}>
            Browse courses
          </Button>
        }
      />
    </>
  );
}
