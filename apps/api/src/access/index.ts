export { AccessModule } from "./access.module";
export {
  AllowWhilePasswordChangeRequired,
  Audience,
  CsrfTokenInBody,
  RequireCourseAccess,
  Roles,
} from "./access.decorators";
export { resolveAccessPolicy } from "./access-policy";
export type { AccessPolicy, AccessTargets } from "./access-policy";
