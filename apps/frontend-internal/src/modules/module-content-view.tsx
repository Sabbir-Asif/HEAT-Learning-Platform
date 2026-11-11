"use client";

import {
  getModulesListQueryKey,
  isApiError,
  useCoursesGet,
  useModulesGet,
  useModulesRemove,
} from "@heat/api-client";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldDescription,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { SearchXIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ModuleForm } from "./module-form";
import { moduleDeleteFailedMessage } from "./modules-copy";
import { SectionsPanel } from "./sections-panel";
import { VideoSlotsPanel } from "./video-slots-panel";

type ModuleContentViewProps = { courseId: string; moduleId: string };

export function ModuleContentView({ courseId, moduleId }: ModuleContentViewProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const course = useCoursesGet(courseId);
  const moduleQuery = useModulesGet(courseId, moduleId);
  const remove = useModulesRemove();
  const [notice, setNotice] = useState<string | null>(null);

  if (moduleQuery.isPending || course.isPending) {
    return (
      <ShellContent>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </ShellContent>
    );
  }

  if (moduleQuery.isError || course.isError) {
    const error = moduleQuery.error ?? course.error;
    const missing = isApiError(error) && error.code === "NOT_FOUND";
    return (
      <ShellContent>
        {missing ? (
          <EmptyState
            icon={SearchXIcon}
            title="Module not found"
            description="It may have been deleted."
          />
        ) : (
          <ErrorState
            title="The module could not be loaded"
            onRetry={() => {
              void moduleQuery.refetch();
              void course.refetch();
            }}
          />
        )}
      </ShellContent>
    );
  }

  const current = moduleQuery.data;
  const locked = course.data.lockedAt !== null;

  return (
    <ShellContent>
      <PageHeader
        title={current.title}
        action={
          <ConfirmDialog
            trigger={
              <Button variant="outline" disabled={locked}>
                <Trash2Icon data-icon="inline-start" />
                Delete module
              </Button>
            }
            title="Delete this module?"
            itemName={current.title}
            description="Its sections, objectives, videos and quiz are deleted with it. This cannot be undone."
            confirmLabel="Delete module"
            confirmationName={current.title}
            destructive
            errorMessage={moduleDeleteFailedMessage(current.title)}
            onConfirm={async () => {
              await remove.mutateAsync({ id: courseId, moduleId });
              await queryClient.invalidateQueries({
                queryKey: getModulesListQueryKey(courseId),
              });
              router.push(`/courses/${courseId}`);
            }}
          />
        }
      />
      <div>
        <Button variant="link" render={<Link href={`/courses/${courseId}`} />}>
          Back to {course.data.title}
        </Button>
      </div>
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <Tabs defaultValue="content">
        <TabsList variant="line">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="flex max-w-2xl flex-col gap-8">
          <ModuleForm
            courseId={courseId}
            module={current}
            locked={locked}
            onSaved={async () => {
              setNotice("The module was saved.");
              await queryClient.invalidateQueries({ queryKey: getModulesListQueryKey(courseId) });
              await moduleQuery.refetch();
            }}
          />
          <SectionsPanel courseId={courseId} module={current} locked={locked} />
        </TabsContent>
        <TabsContent value="video" className="flex max-w-2xl flex-col gap-8">
          <VideoSlotsPanel courseId={courseId} moduleId={moduleId} courseLocked={locked} />
        </TabsContent>
      </Tabs>
    </ShellContent>
  );
}
