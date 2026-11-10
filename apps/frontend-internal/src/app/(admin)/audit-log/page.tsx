import { EmptyState, PageHeader } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { LockIcon } from "lucide-react";
import { AuditLogView } from "@/audit/audit-log-view";
import { verifyReadySession } from "@/auth/session";

export default async function Page() {
  const { user } = await verifyReadySession();
  if (user.role !== "SUPER_ADMIN") {
    return (
      <ShellContent>
        <PageHeader title="Audit log" />
        <EmptyState
          icon={LockIcon}
          title="Only the super admin can read the audit log"
          description="Ask the super admin if you need to check what changed."
        />
      </ShellContent>
    );
  }
  return <AuditLogView />;
}
