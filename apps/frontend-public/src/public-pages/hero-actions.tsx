"use client";

import { Button } from "@heat/ui";
import { PlayIcon } from "lucide-react";
import Link from "next/link";
import { useStudentSession } from "../auth/use-student-session";

export function HeroActions() {
  const state = useStudentSession();
  const signedIn = state.kind === "signed-in";
  return (
    <>
      <Button
        size="lg"
        nativeButton={false}
        render={<Link href={signedIn ? "/dashboard" : "/enroll"} />}
      >
        <PlayIcon aria-hidden="true" data-icon="inline-start" />
        {signedIn ? "Continue learning" : "Start training"}
      </Button>
      <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/#courses" />}>
        Explore courses
      </Button>
    </>
  );
}
