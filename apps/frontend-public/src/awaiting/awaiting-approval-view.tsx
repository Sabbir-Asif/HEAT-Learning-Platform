import type { MeEnrollment } from "@heat/contracts";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatusBadge,
} from "@heat/ui";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export interface AwaitingApprovalViewProps {
  enrollments: ReadonlyArray<MeEnrollment>;
  emailVerified: boolean;
  resendVerification?: ReactNode;
}

const pendingCopy = {
  PENDING_VERIFICATION: "Verify your email address using the link we sent you.",
  PENDING_APPROVAL: "An administrator is reviewing your request.",
  REJECTED: "Your request was not approved.",
  EXPIRED: "This request expired before the email address was verified.",
  REMOVED: "Your access to this course was removed.",
} as const;

type CopyKey = keyof typeof pendingCopy;

const hasCopy = (status: string): status is CopyKey => status in pendingCopy;

interface EnrollmentCardProps {
  enrollment: MeEnrollment;
  emailVerified: boolean;
  resendVerification?: ReactNode;
}

function EnrollmentCard({ enrollment, emailVerified, resendVerification }: EnrollmentCardProps) {
  const { status } = enrollment;
  const opensCourse = status === "APPROVED" || status === "COMPLETED";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{enrollment.courseTitle}</CardTitle>
        <CardAction>
          <StatusBadge kind="enrollment" status={status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hasCopy(status) ? <CardDescription>{pendingCopy[status]}</CardDescription> : null}
        {enrollment.reason !== undefined ? <p>Reason: {enrollment.reason}</p> : null}
        {status === "PENDING_VERIFICATION" && !emailVerified ? resendVerification : null}
        {opensCourse ? (
          <div>
            <Button
              nativeButton={false}
              render={<Link href={`/learn/${encodeURIComponent(enrollment.courseSlug)}`} />}
            >
              Open course
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AwaitingApprovalView({
  enrollments,
  emailVerified,
  resendVerification,
}: AwaitingApprovalViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Awaiting approval"
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/profile" />}>
            Edit profile
          </Button>
        }
      />
      {enrollments.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="You have no enrollment requests"
          action={
            <Button variant="outline" nativeButton={false} render={<Link href="/courses" />}>
              Browse courses
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {enrollments.map((enrollment) => (
            <li key={enrollment.courseId}>
              <EnrollmentCard
                enrollment={enrollment}
                emailVerified={emailVerified}
                resendVerification={resendVerification}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
