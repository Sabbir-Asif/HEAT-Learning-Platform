import type { MeEnrollment, VerificationEmailStatus } from "@heat/contracts";
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
  verificationEmail?: VerificationEmailStatus | null;
  verificationEmailSentAt?: string | null;
}

const sentTimeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});

export function verificationCopy(
  status: VerificationEmailStatus | null | undefined,
  sentAt: string | null | undefined,
): string {
  if (status === "SENT" && sentAt) {
    return `We sent your verification email on ${sentTimeFormat.format(new Date(sentAt))}. Open the link in it to verify your address.`;
  }
  if (status === "SENT") return "We sent your verification email. Open the link in it.";
  if (status === "FAILED") {
    return "We could not send your verification email. Request a new link below.";
  }
  return "Your verification email is on its way";
}

const pendingCopy = {
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
  verificationText: string;
}

function EnrollmentCard({
  enrollment,
  emailVerified,
  resendVerification,
  verificationText,
}: EnrollmentCardProps) {
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
        {status === "PENDING_VERIFICATION" ? (
          <CardDescription role="status">{verificationText}</CardDescription>
        ) : hasCopy(status) ? (
          <CardDescription>{pendingCopy[status]}</CardDescription>
        ) : null}
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
  verificationEmail,
  verificationEmailSentAt,
}: AwaitingApprovalViewProps) {
  const verificationText = verificationCopy(verificationEmail, verificationEmailSentAt);
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
                verificationText={verificationText}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
