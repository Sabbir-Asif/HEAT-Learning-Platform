import { CourseDetailsView } from "@/courses/course-details-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseDetailsView id={id} />;
}
