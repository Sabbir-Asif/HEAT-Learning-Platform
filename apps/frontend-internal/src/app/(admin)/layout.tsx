import type { ReactNode } from "react";
import { verifyReadySession } from "@/auth/session";
import { AdminShell } from "@/shell/admin-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await verifyReadySession();
  return <AdminShell email={user.email}>{children}</AdminShell>;
}
