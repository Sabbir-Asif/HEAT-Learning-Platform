"use client";

import {
  getStudentDetailGetQueryKey,
  getStudentListListQueryKey,
  isApiError,
  useStudentDetailGet,
} from "@heat/api-client";
import type {
  StudentDetailResponseDto,
  StudentDetailResponseDtoEnrollmentsItem,
} from "@heat/api-client";
import {
  Button,
  EmptyState,
  ErrorState,
  FieldDescription,
  PageHeader,
  SectionHeading,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import {
  BanIcon,
  DownloadIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchXIcon,
  UserMinusIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { StudentCertificateSheet } from "./student-certificate-sheet";
import type { StudentCertificateTarget } from "./student-certificate-sheet";
import { StudentRemovalSheet } from "./student-removal-sheet";
import type { StudentRemovalTarget } from "./student-removal-sheet";
import {
  attemptOutcomeLabel,
  attemptScoreLabel,
  canReinstateStudent,
  canReissueCertificate,
  canRevokeCertificate,
  certificateActionNotice,
  canRemoveStudent,
  certificateDownloadHref,
  certificateStatusLabels,
  decisionActionLabels,
  moduleStatusLabels,
  removalNotice,
  studentBadgeStatus,
  videoCoverageLabel,
} from "./student-copy";

type Enrollment = StudentDetailResponseDtoEnrollmentsItem;

function Decisions({ enrollment }: { enrollment: Enrollment }) {
  if (enrollment.decisions.length === 0) {
    return <FieldDescription>No admin decisions yet.</FieldDescription>;
  }
  return (
    <Table aria-label={`Decision history for ${enrollment.course.title}`}>
      <TableHeader>
        <TableRow>
          <TableHead>Decision</TableHead>
          <TableHead>Admin</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {enrollment.decisions.map((decision) => (
          <TableRow key={decision.id}>
            <TableCell>{decisionActionLabels[decision.action]}</TableCell>
            <TableCell>{decision.admin.email}</TableCell>
            <TableCell>{decision.reason ?? "No reason given"}</TableCell>
            <TableCell>{formatDhakaTime(decision.decidedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Modules({ enrollment }: { enrollment: Enrollment }) {
  if (enrollment.modules.length === 0) {
    return <FieldDescription>Modules appear after the enrollment is approved.</FieldDescription>;
  }
  return (
    <div className="flex flex-col gap-4">
      {enrollment.modules.map((module) => (
        <section key={module.moduleId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{`${module.order}. ${module.title}`}</strong>
            <FieldDescription>{moduleStatusLabels[module.status]}</FieldDescription>
          </div>
          {module.videos.length > 0 ? (
            <Table aria-label={`Videos in ${module.title}`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Video</TableHead>
                  <TableHead>Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {module.videos.map((video) => (
                  <TableRow key={video.videoId}>
                    <TableCell>
                      {video.required ? video.title : `${video.title} (optional)`}
                    </TableCell>
                    <TableCell>{videoCoverageLabel(video)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
          {module.quizAttempts.length > 0 ? (
            <Table aria-label={`Quiz attempts in ${module.title}`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {module.quizAttempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{formatDhakaTime(attempt.startedAt)}</TableCell>
                    <TableCell>{attemptScoreLabel(attempt)}</TableCell>
                    <TableCell>{attemptOutcomeLabel(attempt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function Certificate({
  enrollment,
  onAction,
}: {
  enrollment: Enrollment;
  onAction: (target: NonNullable<StudentCertificateTarget>) => void;
}) {
  const certificate = enrollment.certificate;
  if (certificate === null) return <FieldDescription>No certificate yet.</FieldDescription>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="link"
        render={<a href={certificate.verificationUrl} target="_blank" rel="noreferrer" />}
      >
        {certificate.number}
      </Button>
      <FieldDescription>
        {`${certificateStatusLabels[certificate.status]}, ${formatDhakaTime(certificate.issuedAt)}`}
      </FieldDescription>
      {certificate.status === "READY" ? (
        <Button
          size="sm"
          variant="outline"
          render={<a href={certificateDownloadHref(certificate.id)} />}
        >
          <DownloadIcon data-icon="inline-start" />
          Download PDF
        </Button>
      ) : null}
      {canReissueCertificate(certificate.status) ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onAction({ action: "reissue", id: certificate.id, number: certificate.number })
          }
        >
          <RefreshCwIcon data-icon="inline-start" />
          Reissue
        </Button>
      ) : null}
      {canRevokeCertificate(certificate.status) ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onAction({ action: "revoke", id: certificate.id, number: certificate.number })
          }
        >
          <BanIcon data-icon="inline-start" />
          Revoke
        </Button>
      ) : null}
    </div>
  );
}

export function StudentDetailView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const student = useStudentDetailGet(id);
  const [removalTarget, setRemovalTarget] = useState<StudentRemovalTarget>(null);
  const [certificateTarget, setCertificateTarget] = useState<StudentCertificateTarget>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (student.isPending) {
    return (
      <ShellContent>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </ShellContent>
    );
  }

  if (student.isError) {
    const missing = isApiError(student.error) && student.error.code === "NOT_FOUND";
    return (
      <ShellContent>
        {missing ? (
          <EmptyState
            icon={SearchXIcon}
            title="Student not found"
            description="The account may have been deleted."
          />
        ) : (
          <ErrorState
            title="The student could not be loaded"
            onRetry={() => void student.refetch()}
          />
        )}
      </ShellContent>
    );
  }

  const current: StudentDetailResponseDto = student.data;

  return (
    <ShellContent>
      <PageHeader title={current.name} />
      <FieldDescription>
        {`${current.email} - ${current.department.name}, ${current.faculty.name}, ${current.university.name} - Session ${current.session}`}
      </FieldDescription>
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      {current.enrollments.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No enrollments"
          description="This student has not requested a course."
        />
      ) : null}
      {current.enrollments.map((enrollment) => (
        <section
          key={enrollment.id}
          aria-labelledby={`enrollment-${enrollment.id}`}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SectionHeading id={`enrollment-${enrollment.id}`}>
              {enrollment.course.title}
            </SectionHeading>
            <StatusBadge kind="enrollment" status={studentBadgeStatus(enrollment.status)} />
            {canRemoveStudent(enrollment.status) ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNotice(null);
                  setRemovalTarget({ action: "remove", id: enrollment.id, name: current.name });
                }}
              >
                <UserMinusIcon data-icon="inline-start" />
                Remove
              </Button>
            ) : null}
            {canReinstateStudent(enrollment.status) ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNotice(null);
                  setRemovalTarget({ action: "reinstate", id: enrollment.id, name: current.name });
                }}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Reinstate
              </Button>
            ) : null}
          </div>
          <FieldDescription>{`Requested ${formatDhakaTime(enrollment.requestedAt)}`}</FieldDescription>
          <Decisions enrollment={enrollment} />
          <Modules enrollment={enrollment} />
          <Certificate
            enrollment={enrollment}
            onAction={(target) => {
              setNotice(null);
              setCertificateTarget(target);
            }}
          />
        </section>
      ))}
      <StudentRemovalSheet
        target={removalTarget}
        onClose={() => setRemovalTarget(null)}
        onFinished={(action, name) => {
          setNotice(removalNotice(action, name));
          void queryClient.invalidateQueries({ queryKey: getStudentDetailGetQueryKey(id) });
          void queryClient.invalidateQueries({
            queryKey: getStudentListListQueryKey().slice(0, 1),
          });
        }}
      />
      <StudentCertificateSheet
        target={certificateTarget}
        onClose={() => setCertificateTarget(null)}
        onFinished={(action, number) => {
          setNotice(certificateActionNotice(action, number));
          void queryClient.invalidateQueries({ queryKey: getStudentDetailGetQueryKey(id) });
        }}
      />
    </ShellContent>
  );
}
