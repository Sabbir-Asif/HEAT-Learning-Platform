export type RouteKind = "admin" | "auth";

export interface RouteEntry {
  pattern: string;
  path: string;
  kind: RouteKind;
}

export const routeManifest: ReadonlyArray<RouteEntry> = [
  { pattern: "/", path: "/", kind: "admin" },
  { pattern: "/insights", path: "/insights", kind: "admin" },
  { pattern: "/enrollments", path: "/enrollments", kind: "admin" },
  { pattern: "/students", path: "/students", kind: "admin" },
  { pattern: "/profile-changes", path: "/profile-changes", kind: "admin" },
  { pattern: "/students/[id]", path: "/students/sample-id", kind: "admin" },
  { pattern: "/courses", path: "/courses", kind: "admin" },
  { pattern: "/courses/[id]", path: "/courses/sample-id", kind: "admin" },
  {
    pattern: "/courses/[id]/modules/[moduleId]",
    path: "/courses/sample-id/modules/sample-module",
    kind: "admin",
  },
  { pattern: "/courses/[id]/preview", path: "/courses/sample-id/preview", kind: "admin" },
  { pattern: "/videos", path: "/videos", kind: "admin" },
  { pattern: "/directory/universities", path: "/directory/universities", kind: "admin" },
  { pattern: "/directory/faculties", path: "/directory/faculties", kind: "admin" },
  { pattern: "/directory/departments", path: "/directory/departments", kind: "admin" },
  { pattern: "/content/resources", path: "/content/resources", kind: "admin" },
  { pattern: "/content/news", path: "/content/news", kind: "admin" },
  { pattern: "/content/news/[id]", path: "/content/news/sample-id", kind: "admin" },
  { pattern: "/content/pages", path: "/content/pages", kind: "admin" },
  { pattern: "/content/tags", path: "/content/tags", kind: "admin" },
  { pattern: "/admins", path: "/admins", kind: "admin" },
  { pattern: "/audit-log", path: "/audit-log", kind: "admin" },
  { pattern: "/account", path: "/account", kind: "admin" },
  { pattern: "/sign-in", path: "/sign-in", kind: "auth" },
  { pattern: "/accept-invite/[token]", path: "/accept-invite/sample-token", kind: "auth" },
  { pattern: "/forgot-password", path: "/forgot-password", kind: "auth" },
  { pattern: "/reset-password/[token]", path: "/reset-password/sample-token", kind: "auth" },
];

export const routePaths: ReadonlyArray<string> = routeManifest.map((route) => route.path);
