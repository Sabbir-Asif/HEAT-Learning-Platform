"use client";

import {
  getCoursesGetQueryKey,
  getCoursesListQueryKey,
  getCoursesPublishChecksQueryKey,
  isApiError,
  useCoursesGet,
  useCoursesPublishChecks,
  useCoursesPublish,
} from "@heat/api-client";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldDescription,
  PageHeader,
  SectionHeading,
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
import { ModulesTab } from "../modules/modules-tab";
import { FrontPageTab } from "../tags/front-page-tab";
import { CourseForm } from "./course-form";
import { RevisionsTab } from "./revisions-tab";
import {
  publishBlockersTitle,
  publishChecklistClearMessage,
  publishChecklistFailedMessage,
  publishFailedMessage,
} from "./courses-copy";

export function CourseDetailsView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const course = useCoursesGet(id);
  const publish = useCoursesPublish();
  const checklist = useCoursesPublishChecks(id, {
    query: { enabled: course.data?.status === "DRAFT" },
  });
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
      queryClient.invalidateQueries({ queryKey: getCoursesPublishChecksQueryKey(id) }),
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
                  void checklist.refetch();
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
      {current.status === "DRAFT" ? (
        <section aria-labelledby="publish-checklist" className="flex flex-col gap-2">
          <SectionHeading id="publish-checklist">
            {checklist.isSuccess && checklist.data.failures.length > 0
              ? publishBlockersTitle(checklist.data.failures.length)
              : "Publish checklist"}
          </SectionHeading>
          {checklist.isPending ? <Skeleton className="h-6 w-80" /> : null}
          {checklist.isError ? (
            <ErrorState
              title={publishChecklistFailedMessage}
              onRetry={() => void checklist.refetch()}
            />
          ) : null}
          {checklist.isSuccess && checklist.data.failures.length === 0 ? (
            <FieldDescription role="status">{publishChecklistClearMessage}</FieldDescription>
          ) : null}
          {checklist.isSuccess && checklist.data.failures.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {checklist.data.failures.map((failure) => (
                <li key={`${failure.code}-${failure.moduleId}-${failure.questionId}`}>
                  <FieldDescription>{failure.message}</FieldDescription>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      <Tabs defaultValue="details">
        <TabsList variant="line">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="revisions">Revisions</TabsTrigger>
          <TabsTrigger value="front-page">Front page</TabsTrigger>
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
        <TabsContent value="modules">
          <ModulesTab courseId={id} />
        </TabsContent>
        <TabsContent value="revisions">
          <RevisionsTab courseId={id} />
        </TabsContent>
        <TabsContent value="front-page">
          <FrontPageTab courseId={id} />
        </TabsContent>
      </Tabs>
    </ShellContent>
  );
}
