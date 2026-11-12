"use client";

import { isApiError, useCoursesGet, useModulesList } from "@heat/api-client";
import {
  Button,
  EmptyState,
  ErrorState,
  FieldDescription,
  PageHeader,
  Skeleton,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { LayersIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { ModulePreview } from "./module-preview";
import { previewNotice } from "./preview-copy";

export function CoursePreviewView({ courseId }: { courseId: string }) {
  const course = useCoursesGet(courseId);
  const modules = useModulesList(courseId);

  if (course.isPending || modules.isPending) {
    return (
      <ShellContent>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </ShellContent>
    );
  }

  if (course.isError || modules.isError) {
    const error = course.error ?? modules.error;
    const missing = isApiError(error) && error.code === "NOT_FOUND";
    return (
      <ShellContent>
        {missing ? (
          <EmptyState
            icon={SearchXIcon}
            title="Course not found"
            description="It may have been deleted."
          />
        ) : (
          <ErrorState
            title="The preview could not be loaded"
            onRetry={() => {
              void course.refetch();
              void modules.refetch();
            }}
          />
        )}
      </ShellContent>
    );
  }

  const items = modules.data.items;

  return (
    <ShellContent>
      <PageHeader title={course.data.title} />
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="course" status={course.data.status} />
        <FieldDescription role="status">{previewNotice}</FieldDescription>
        <Button variant="link" nativeButton={false} render={<Link href={`/courses/${courseId}`} />}>
          Back to course
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={LayersIcon}
          title="No modules yet"
          description="Add modules to the course to preview them."
        />
      ) : (
        <Tabs defaultValue={items[0]?.id}>
          <TabsList variant="line">
            {items.map((module) => (
              <TabsTrigger key={module.id} value={module.id}>
                {module.order}. {module.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {items.map((module) => (
            <TabsContent key={module.id} value={module.id} className="max-w-3xl">
              <ModulePreview courseId={courseId} module={module} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </ShellContent>
  );
}
