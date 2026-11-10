import { SignOutButton } from "@/auth/sign-out-button";
import { PlaceholderPage } from "@/shell/placeholder-page";

export default function Page() {
  return <PlaceholderPage title="Profile" action={<SignOutButton />} />;
}
