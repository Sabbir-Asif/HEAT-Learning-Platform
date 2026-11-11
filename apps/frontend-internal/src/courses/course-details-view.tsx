"use client";

import {
  getCoursesGetQueryKey,
  getCoursesListQueryKey,
  isApiError,
  useCoursesGet,
  useCoursesPublish,
} from "@heat/api-client";
import {
  Button,
  ConfirmDialog,
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
import { useQueryClient } from "@tanstack/react-query";
import { GlobeIcon, SearchXIcon } from "lucide-react";
import { useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { CourseForm } from "./course-form";
import { publishFailedMessage } from "./courses-copy";

export function CourseDetailsView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const course = useCoursesGet(id);
  const publish = useCoursesPublish();
  const [notice, setNotice] = useState<string | null>(null);
  const [failures, setFailures] = useState<readonly string[]>([]);

  if (course.isPending) {
    return (
      <ShellContent>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </ShellContent>
    );
  }

  if (course.isError) {
    const missing = isApiError(course.error) && course.error.code === "NOT_FOUND";
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
            title="The course could not be loaded"
            onRetry={() => void course.refetch()}
          />
        )}
      </ShellContent>
    );
  }

  const current = course.data;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getCoursesGetQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: getCoursesListQueryKey().slice(0, 1) }),
    ]);

  return (
    <ShellContent>
      <PageHeader
        title={current.title}
        action={
          current.status === "DRAFT" ? (
            <ConfirmDialog
              trigger={
                <Button>
                  <GlobeIcon data-icon="inline-start" />
                  Publish
                </Button>
              }
              title="Publish this course?"
              itemName={current.title}
              description="Students can enroll once it is published. A published course cannot be deleted."
              confirmLabel="Publish course"
              errorMessage={publishFailedMessage(current.title, failures)}
              onConfirm={async () => {
                setNotice(null);
                setFailures([]);
                try {
                  await publish.mutateAsync({ id });
                } catch (error) {
                  if (isApiError(error)) setFailures(error.failures);
                  throw error;
                }
                await refresh();
                setNotice(`${current.title} was published.`);
              }}
            />
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="course" status={current.lockedAt === null ? current.status : "locked"} />
        <FieldDescription>
          Updated {formatDhakaTime(current.updatedAt)}
          {current.currentRevision ? ` - Revision ${current.currentRevision.number}` : ""}
        </FieldDescription>
      </div>
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <Tabs defaultValue="details">
        <TabsList variant="line">
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="max-w-2xl">
          <CourseForm
            course={current}
            onSaved={async () => {
              setNotice("The course was saved.");
              await refresh();
            }}
          />
        </TabsContent>
      </Tabs>
    </ShellContent>
  );
}
