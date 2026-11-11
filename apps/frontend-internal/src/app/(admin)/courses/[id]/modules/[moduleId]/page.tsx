import { ModuleContentView } from "@/modules/module-content-view";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  return <ModuleContentView courseId={id} moduleId={moduleId} />;
}
