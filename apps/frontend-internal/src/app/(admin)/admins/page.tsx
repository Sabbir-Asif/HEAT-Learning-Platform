import { EmptyState, PageHeader } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { LockIcon } from "lucide-react";
import { AdminsView } from "@/admins/admins-view";
import { verifyReadySession } from "@/auth/session";

export default async function Page() {
  const { user } = await verifyReadySession();
  if (user.role !== "SUPER_ADMIN") {
    return (
      <ShellContent>
        <PageHeader title="Admins" />
        <EmptyState
          icon={LockIcon}
          title="Only the super admin can manage admins"
          description="Ask the super admin if you need an account changed."
        />
      </ShellContent>
    );
  }
  return <AdminsView currentUserId={user.id} />;
}
