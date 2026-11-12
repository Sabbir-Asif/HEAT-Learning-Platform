import { CourseOverview } from "@/public-pages/course-overview";
import { cachedCourse } from "@/public-pages/public-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await cachedCourse(slug);
  return course === null ? {} : { title: course.title };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const course = await cachedCourse(slug);
  if (course === null) notFound();
  return <CourseOverview course={course} />;
}
