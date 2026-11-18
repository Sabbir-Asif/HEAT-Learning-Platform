"use client";

import { isApiError, useRevisionsSnapshot } from "@heat/api-client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { ArrowLeftIcon, SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { formatDhakaTime } from "../admins/admin-copy";
import { RevisionSnapshotModules } from "./revision-snapshot-modules";
import { RevisionSnapshotStudents } from "./revision-snapshot-students";
import {
  revisionModuleCountLabel,
  revisionSnapshotLoadFailedMessage,
  revisionSnapshotNotice,
} from "./revisions-copy";

type RevisionSnapshotViewProps = { courseId: string; revisionId: string };

export function RevisionSnapshotView({ courseId, revisionId }: RevisionSnapshotViewProps) {
  const snapshot = useRevisionsSnapshot(courseId, revisionId);

  if (snapshot.isPending) {
    return (
      <ShellContent>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </ShellContent>
    );
  }

  if (snapshot.isError) {
    const missing = isApiError(snapshot.error) && snapshot.error.code === "NOT_FOUND";
    return (
      <ShellContent>
        {missing ? (
          <EmptyState
            icon={SearchXIcon}
            title="Revision not found"
            description="It may belong to a different course."
          />
        ) : (
          <ErrorState
            title={revisionSnapshotLoadFailedMessage}
            onRetry={() => void snapshot.refetch()}
          />
        )}
      </ShellContent>
    );
  }

  const { revision, modules, students } = snapshot.data;

  return (
    <ShellContent>
      <PageHeader
        title={`Revision ${revision.number}`}
        description={
          revision.publishedAt === null
            ? "A draft. Read-only here; edit it from the course."
            : `Published ${formatDhakaTime(revision.publishedAt)}. Read-only snapshot.`
        }
        breadcrumbs={
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            render={<Link href={`/courses/${courseId}`} />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back to the course
          </Button>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {revision.current ? <Badge variant="outline">Latest</Badge> : null}
            <StatusBadge
              kind="course"
              status={
                revision.locked ? "locked" : revision.status === "DRAFT" ? "draft" : "published"
              }
            />
          </div>
        }
      />
      <Card size="sm">
        <CardContent className="flex items-start gap-3">
          <UsersIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p role="note">{revisionSnapshotNotice(revision.status, students.total)}</p>
        </CardContent>
      </Card>
      <Tabs defaultValue="content">
        <TabsList variant="line">
          <TabsTrigger value="content">
            Content ({revisionModuleCountLabel(modules.length)})
          </TabsTrigger>
          <TabsTrigger value="students">Students ({students.total})</TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <RevisionSnapshotModules modules={modules} />
        </TabsContent>
        <TabsContent value="students">
          <RevisionSnapshotStudents students={students} />
        </TabsContent>
      </Tabs>
    </ShellContent>
  );
}
