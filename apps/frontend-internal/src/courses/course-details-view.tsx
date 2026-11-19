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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldDescription,
  PageHeader,
  Skeleton,
  StatCard,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon, CircleCheckIcon, EyeIcon, GlobeIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { ModulesTab } from "../modules/modules-tab";
import { CourseForm } from "./course-form";
import { HomePageCard } from "./home-page-card";
import { isContentLocked } from "./courses-status";
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/courses/${id}/preview`} />}
            >
              <EyeIcon data-icon="inline-start" />
              Preview
            </Button>
            {current.status === "DRAFT" ? (
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
            ) : null}
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge kind="course" status={isContentLocked(current) ? "locked" : current.status} />
        <FieldDescription>/{current.slug}</FieldDescription>
      </div>
      <HomePageCard courseId={id} published={current.status === "PUBLISHED"} />
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Enrollments" value={String(current.enrollmentCount)} />
        <StatCard
          label="Revision"
          value={current.currentRevision ? `#${current.currentRevision.number}` : "None"}
        />
        <StatCard
          label="Published"
          value={current.publishedAt ? formatDhakaTime(current.publishedAt) : "Not yet"}
        />
        <StatCard label="Last updated" value={formatDhakaTime(current.updatedAt)} />
      </div>
      {current.status === "DRAFT" ? (
        <Card aria-labelledby="publish-checklist">
          <CardHeader>
            <CardTitle id="publish-checklist">
              {checklist.isSuccess && checklist.data.failures.length > 0
                ? publishBlockersTitle(checklist.data.failures.length)
                : "Publish checklist"}
            </CardTitle>
            <CardDescription>
              A draft can be published once every item below is clear.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {checklist.isPending ? <Skeleton className="h-6 w-80" /> : null}
            {checklist.isError ? (
              <ErrorState
                title={publishChecklistFailedMessage}
                onRetry={() => void checklist.refetch()}
              />
            ) : null}
            {checklist.isSuccess && checklist.data.failures.length === 0 ? (
              <div role="status" className="flex items-center gap-2">
                <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0" />
                <FieldDescription>{publishChecklistClearMessage}</FieldDescription>
              </div>
            ) : null}
            {checklist.isSuccess && checklist.data.failures.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {checklist.data.failures.map((failure) => (
                  <li
                    key={`${failure.code}-${failure.moduleId}-${failure.questionId}`}
                    className="flex items-start gap-2"
                  >
                    <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <FieldDescription>{failure.message}</FieldDescription>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <Tabs defaultValue="details">
        <TabsList variant="line">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="revisions">Revisions</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <Card className="max-w-5xl">
            <CardHeader>
              <CardTitle>Course details</CardTitle>
              <CardDescription>The title, address and description learners see.</CardDescription>
            </CardHeader>
            <CardContent>
              <CourseForm
                course={current}
                onSaved={async () => {
                  setNotice("The course was saved.");
                  await refresh();
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="modules">
          <ModulesTab courseId={id} />
        </TabsContent>
        <TabsContent value="revisions">
          <RevisionsTab courseId={id} />
        </TabsContent>
      </Tabs>
    </ShellContent>
  );
}
