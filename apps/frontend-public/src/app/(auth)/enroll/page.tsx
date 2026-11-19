import { redirect } from "next/navigation";
import { CourseRequired } from "@/enroll/course-required";
import { EnrollGate } from "@/enroll/enroll-gate";
import { cachedCourse, cachedFrontPage } from "@/public-pages/public-data";
import { enrollHref } from "@/public-pages/links";

interface EnrollPageProps {
  searchParams: Promise<{ course?: string | string[] }>;
}

export default async function Page({ searchParams }: EnrollPageProps) {
  const { course } = await searchParams;
  const requested = Array.isArray(course) ? course[0] : course;
  if (requested === undefined || requested === "") {
    const { courses } = await cachedFrontPage();
    const [only, ...others] = courses;
    if (only !== undefined && others.length === 0) redirect(enrollHref(only.slug));
    return <CourseRequired courses={courses} />;
  }
  const found = await cachedCourse(requested);
  return <EnrollGate courseSlug={requested} courseTitle={found?.title} />;
}
