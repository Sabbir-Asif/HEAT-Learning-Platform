import { CoursePreviewView } from "@/preview/course-preview-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CoursePreviewView courseId={id} />;
}
