import { AwaitingApprovalView } from "@/awaiting/awaiting-approval-view";
import { ResendVerificationForm } from "@/awaiting/resend-verification-form";
import { verifySession } from "@/auth/session";

export default async function Page() {
  const { user, enrollments, verificationEmail, verificationEmailSentAt } = await verifySession();
  return (
    <AwaitingApprovalView
      enrollments={enrollments}
      emailVerified={user.emailVerified}
      verificationEmail={verificationEmail}
      verificationEmailSentAt={verificationEmailSentAt}
      resendVerification={<ResendVerificationForm defaultEmail={user.email} />}
    />
  );
}
