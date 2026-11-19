export type RouteKind = "public" | "learner" | "auth";

export interface RouteEntry {
  pattern: string;
  path: string;
  kind: RouteKind;
}

export const routeManifest: ReadonlyArray<RouteEntry> = [
  { pattern: "/", path: "/", kind: "public" },
  { pattern: "/courses/[slug]", path: "/courses/sample-course", kind: "public" },
  { pattern: "/verify", path: "/verify", kind: "public" },
  { pattern: "/verify/[certificateNumber]", path: "/verify/sample-number", kind: "public" },
  { pattern: "/privacy", path: "/privacy", kind: "public" },
  { pattern: "/terms", path: "/terms", kind: "public" },
  { pattern: "/accessibility", path: "/accessibility", kind: "public" },
  { pattern: "/sign-in", path: "/sign-in", kind: "auth" },
  { pattern: "/enroll", path: "/enroll", kind: "auth" },
  { pattern: "/forgot-password", path: "/forgot-password", kind: "auth" },
  { pattern: "/reset-password/[token]", path: "/reset-password/sample-token", kind: "auth" },
  { pattern: "/verify-email/[token]", path: "/verify-email/sample-token", kind: "auth" },
  { pattern: "/awaiting-approval", path: "/awaiting-approval", kind: "auth" },
  { pattern: "/dashboard", path: "/dashboard", kind: "learner" },
  { pattern: "/learn", path: "/learn", kind: "learner" },
  { pattern: "/learn/[course]", path: "/learn/sample-course", kind: "learner" },
  {
    pattern: "/learn/[course]/[module]",
    path: "/learn/sample-course/sample-module",
    kind: "learner",
  },
  {
    pattern: "/learn/[course]/[module]/quiz",
    path: "/learn/sample-course/sample-module/quiz",
    kind: "learner",
  },
  {
    pattern: "/learn/[course]/[module]/quiz/result/[attempt]",
    path: "/learn/sample-course/sample-module/quiz/result/sample-attempt",
    kind: "learner",
  },
  { pattern: "/certificates", path: "/certificates", kind: "learner" },
  { pattern: "/notifications", path: "/notifications", kind: "learner" },
  { pattern: "/profile", path: "/profile", kind: "learner" },
];

export const routePaths: ReadonlyArray<string> = routeManifest.map((route) => route.path);
