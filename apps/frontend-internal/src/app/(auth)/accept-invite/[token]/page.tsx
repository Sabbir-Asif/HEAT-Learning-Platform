import { AcceptInvite } from "@/admins/accept-invite";

interface AcceptInvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function Page({ params }: AcceptInvitePageProps) {
  const { token } = await params;
  return <AcceptInvite token={token} />;
}
