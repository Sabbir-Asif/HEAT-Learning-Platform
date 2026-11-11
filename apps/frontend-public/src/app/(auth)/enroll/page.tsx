import { CourseRequired } from "@/enroll/course-required";
import { EnrollWizard } from "@/enroll/enroll-wizard";

interface EnrollPageProps {
  searchParams: Promise<{ course?: string | string[] }>;
}

export default async function Page({ searchParams }: EnrollPageProps) {
  const { course } = await searchParams;
  const requested = Array.isArray(course) ? course[0] : course;
  if (requested === undefined || requested === "") return <CourseRequired />;
  return <EnrollWizard courseSlug={requested} />;
}
