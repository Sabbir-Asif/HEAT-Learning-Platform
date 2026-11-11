import { AwaitingApprovalView } from "@/awaiting/awaiting-approval-view";
import { verifySession } from "@/auth/session";

export default async function Page() {
  const { user, enrollments } = await verifySession();
  return <AwaitingApprovalView enrollments={enrollments} emailVerified={user.emailVerified} />;
}
