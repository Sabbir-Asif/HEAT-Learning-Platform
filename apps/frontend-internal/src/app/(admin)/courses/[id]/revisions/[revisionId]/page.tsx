import { RevisionSnapshotView } from "@/courses/revision-snapshot-view";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; revisionId: string }>;
}) {
  const { id, revisionId } = await params;
  return <RevisionSnapshotView courseId={id} revisionId={revisionId} />;
}
