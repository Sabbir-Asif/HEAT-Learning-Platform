"use client";

import { useProfileDescribe } from "@heat/api-client";
import type { ProfileResponseDto } from "@heat/api-client";
import {
  Avatar,
  Badge,
  ErrorState,
  FieldDescription,
  FieldTitle,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import {
  BadgeCheckIcon,
  BuildingIcon,
  CameraIcon,
  GraduationCapIcon,
  KeyRoundIcon,
  MailIcon,
  PencilLineIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { SignOutButton } from "../auth/sign-out-button";
import { ResendVerificationForm } from "../awaiting/resend-verification-form";
import { AvatarSection } from "./avatar-section";
import { ChangeRequestSection } from "./change-request-section";
import { DetailsForm } from "./details-form";
import { PasswordSection } from "./password-section";

function ProfileCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card ring-divider flex flex-col gap-5 rounded-xl p-6 ring-1 md:p-8">
      {title === undefined ? null : (
        <div className="border-border/60 flex items-start gap-3 border-b pb-5">
          <span
            aria-hidden="true"
            className="bg-accent text-accent-foreground grid size-10 shrink-0 place-items-center rounded-lg [&>svg]:size-5"
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="font-heading text-lg font-semibold">{title}</h3>
            {description === undefined ? null : (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

function ProfileHero({ profile }: { profile: ProfileResponseDto }) {
  return (
    <section
      aria-label="Your account"
      className="bg-card ring-divider flex flex-col gap-5 rounded-xl p-6 ring-1 sm:flex-row sm:items-center md:p-8"
    >
      <Avatar src={profile.avatarUrl} name={profile.name} className="size-20 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-bold break-words">{profile.name}</h2>
          <p className="text-muted-foreground flex items-center gap-2 text-sm break-all">
            <MailIcon aria-hidden="true" className="size-4 shrink-0" />
            {profile.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            <GraduationCapIcon aria-hidden="true" />
            {profile.department.name}
          </Badge>
          <Badge variant="secondary">
            <BuildingIcon aria-hidden="true" />
            {profile.university.name}
          </Badge>
          {profile.emailVerified ? (
            <Badge variant="secondary">
              <BadgeCheckIcon aria-hidden="true" />
              Email verified
            </Badge>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ProfileScreen() {
  const profile = useProfileDescribe();
  if (profile.isPending) {
    return (
      <ShellContent aria-busy="true">
        <p role="status" className="sr-only">
          Loading
        </p>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </ShellContent>
    );
  }
  if (profile.isError) {
    return (
      <ShellContent>
        <PageHeader title="Profile" />
        <ErrorState onRetry={() => void profile.refetch()} />
      </ShellContent>
    );
  }
  const data = profile.data;
  return (
    <ShellContent className="gap-6">
      <PageHeader
        title="Profile"
        description="Manage your details, your picture and your sign-in security."
        action={<SignOutButton />}
      />
      <ProfileHero profile={data} />
      <Tabs defaultValue="details" className="gap-6">
        <TabsList>
          <TabsTrigger value="details">
            <UserIcon aria-hidden="true" />
            Personal details
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldCheckIcon aria-hidden="true" />
            Security
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="details"
          className="grid items-start gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]"
        >
          <ProfileCard icon={<CameraIcon />} title="Picture" description="Shown next to your name.">
            <AvatarSection profile={data} />
          </ProfileCard>
          <div className="flex min-w-0 flex-col gap-6">
            <ProfileCard
              icon={<UserIcon />}
              title="Name and academic details"
              description="Your name is printed on your certificate."
            >
              <DetailsForm
                key={`${data.name}-${data.session}-${data.department.id}`}
                profile={data}
              />
            </ProfileCard>
            {data.locked ? (
              <ProfileCard
                icon={<PencilLineIcon />}
                title="Request a change"
                description="An admin reviews every request."
              >
                <ChangeRequestSection profile={data} />
              </ProfileCard>
            ) : null}
          </div>
        </TabsContent>
        <TabsContent value="security" className="grid max-w-3xl gap-6">
          <ProfileCard
            icon={<MailIcon />}
            title="Email"
            description="Used to sign in and for notices."
          >
            <section aria-labelledby="profile-email" className="flex flex-col gap-3">
              <FieldTitle id="profile-email" className="sr-only">
                Email
              </FieldTitle>
              <FieldDescription>{data.email}</FieldDescription>
              {data.emailVerified ? (
                <FieldDescription>Your email address is verified.</FieldDescription>
              ) : (
                <>
                  <FieldDescription>Your email address is not verified yet.</FieldDescription>
                  <ResendVerificationForm defaultEmail={data.email} />
                </>
              )}
            </section>
          </ProfileCard>
          <ProfileCard
            icon={<KeyRoundIcon />}
            title="Password"
            description="Choose a long, unique password."
          >
            <PasswordSection emailVerified={data.emailVerified} />
          </ProfileCard>
        </TabsContent>
      </Tabs>
    </ShellContent>
  );
}
