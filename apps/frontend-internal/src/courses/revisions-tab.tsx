"use client";

import {
  getCoursesGetQueryKey,
  getCoursesPublishChecksQueryKey,
  getRevisionsListQueryKey,
  isApiError,
  useRevisionsClone,
  useRevisionsList,
  useRevisionsPublish,
} from "@heat/api-client";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldDescription,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CopyPlusIcon, GlobeIcon, HistoryIcon } from "lucide-react";
import { useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import {
  canCloneRevisions,
  cloneRevisionDescription,
  cloneRevisionFailedMessage,
  cloneRevisionTitle,
  publishRevisionDescription,
  publishRevisionFailedMessage,
  publishRevisionTitle,
  revisionEnrollmentLabel,
  revisionLabel,
  revisionLockedNote,
  revisionsLoadFailedMessage,
} from "./revisions-copy";

export function RevisionsTab({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const list = useRevisionsList(courseId);
  const clone = useRevisionsClone();
  const publish = useRevisionsPublish();
  const [notice, setNotice] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | undefined>(undefined);
  const [failures, setFailures] = useState<readonly string[]>([]);

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (list.isError) {
    return <ErrorState title={revisionsLoadFailedMessage} onRetry={() => void list.refetch()} />;
  }

  const items = list.data.items;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getRevisionsListQueryKey(courseId) }),
      queryClient.invalidateQueries({ queryKey: getCoursesGetQueryKey(courseId) }),
      queryClient.invalidateQueries({ queryKey: getCoursesPublishChecksQueryKey(courseId) }),
    ]);

  const cloneAction = (
    <ConfirmDialog
      trigger={
        <Button disabled={!canCloneRevisions(items)}>
          <CopyPlusIcon data-icon="inline-start" />
          Clone latest revision
        </Button>
      }
      title={cloneRevisionTitle}
      itemName={items[0] ? revisionLabel(items[0]) : "Revision"}
      description={cloneRevisionDescription}
      confirmLabel="Clone revision"
      errorMessage={cloneRevisionFailedMessage(cloneError)}
      onConfirm={async () => {
        setNotice(null);
        setCloneError(undefined);
        try {
          const created = await clone.mutateAsync({ id: courseId });
          await refresh();
          setNotice(`${revisionLabel(created)} was created as a draft.`);
        } catch (error) {
          setCloneError(isApiError(error) ? error.code : undefined);
          await refresh();
          throw error;
        }
      }}
    />
  );

  if (items.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="No revisions yet"
        description="A revision is created with the course."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>{cloneAction}</div>
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <FieldDescription role="note">{revisionLockedNote}</FieldDescription>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Revision</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Students</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{revisionLabel(item)}</TableCell>
              <TableCell>
                <StatusBadge
                  kind="course"
                  status={item.locked ? "locked" : item.status === "DRAFT" ? "draft" : "published"}
                />
              </TableCell>
              <TableCell>{revisionEnrollmentLabel(item.enrollmentCount)}</TableCell>
              <TableCell>
                {item.publishedAt === null ? "Not published" : formatDhakaTime(item.publishedAt)}
              </TableCell>
              <TableCell>
                {item.status === "DRAFT" ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline">
                        <GlobeIcon data-icon="inline-start" />
                        Publish
                      </Button>
                    }
                    title={publishRevisionTitle}
                    itemName={revisionLabel(item)}
                    description={publishRevisionDescription}
                    confirmLabel="Publish revision"
                    errorMessage={publishRevisionFailedMessage(failures)}
                    onConfirm={async () => {
                      setNotice(null);
                      setFailures([]);
                      try {
                        await publish.mutateAsync({ id: courseId, revisionId: item.id });
                      } catch (error) {
                        if (isApiError(error)) setFailures(error.failures);
                        throw error;
                      }
                      await refresh();
                      setNotice(`${revisionLabel(item)} was published.`);
                    }}
                  />
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
