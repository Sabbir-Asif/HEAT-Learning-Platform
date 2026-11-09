import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { IS_PUBLIC } from "../auth/public.decorator";
import type { AuthRealm, UserRoleName } from "../auth/auth.types";
import {
  ALLOW_PASSWORD_CHANGE_KEY,
  AUDIENCE_KEY,
  COURSE_ACCESS_KEY,
  ROLES_KEY,
} from "./access.decorators";

export type AccessTargets = [
  handler: ReturnType<ExecutionContext["getHandler"]>,
  controller: ReturnType<ExecutionContext["getClass"]>,
];

export type AccessPolicy =
  | { kind: "public" }
  | {
      kind: "protected";
      audience: AuthRealm;
      roles: UserRoleName[];
      courseParam?: string;
      allowWhilePasswordChangeRequired: boolean;
    }
  | { kind: "denied"; reason: string };

const adminRoles: readonly UserRoleName[] = ["ADMIN", "SUPER_ADMIN"];
const studentRoles: readonly UserRoleName[] = ["STUDENT"];

const denied = (reason: string): AccessPolicy => ({ kind: "denied", reason });

const allowedRoles = (audience: AuthRealm): readonly UserRoleName[] =>
  audience === "admin" ? adminRoles : studentRoles;

export const resolveAccessPolicy = (reflector: Reflector, targets: AccessTargets): AccessPolicy => {
  const read = <T>(key: string): T | undefined =>
    reflector.getAllAndOverride<T | undefined>(key, [...targets]);
  const isPublic = read<boolean>(IS_PUBLIC) === true;
  const audience = read<AuthRealm>(AUDIENCE_KEY);
  const roles = read<UserRoleName[]>(ROLES_KEY);
  const courseParam = read<string>(COURSE_ACCESS_KEY);
  const allowPasswordChange = read<boolean>(ALLOW_PASSWORD_CHANGE_KEY) === true;

  if (isPublic) {
    const combined = [AUDIENCE_KEY, ROLES_KEY, COURSE_ACCESS_KEY, ALLOW_PASSWORD_CHANGE_KEY].some(
      (key) => targets.some((target) => reflector.get<unknown>(key, target) !== undefined),
    );
    return combined
      ? denied(
          "Public cannot be combined with Audience, Roles, RequireCourseAccess or AllowWhilePasswordChangeRequired at any level",
        )
      : { kind: "public" };
  }
  if (audience === undefined) {
    return denied("No access metadata: add Public, or Audience with Roles for admin routes");
  }
  const permitted = allowedRoles(audience);
  if (
    roles !== undefined &&
    (roles.length === 0 || roles.some((role) => !permitted.includes(role)))
  ) {
    return denied(`Roles do not match the ${audience} audience`);
  }
  if (audience === "admin" && roles === undefined) {
    return denied("Admin routes must declare Roles explicitly");
  }
  if (courseParam !== undefined && audience !== "student") {
    return denied("RequireCourseAccess is only valid for the student audience");
  }
  if (allowPasswordChange && audience !== "admin") {
    return denied("AllowWhilePasswordChangeRequired is only valid for the admin audience");
  }
  return {
    kind: "protected",
    allowWhilePasswordChangeRequired: allowPasswordChange,
    audience,
    roles: roles ?? [...studentRoles],
    ...(courseParam === undefined ? {} : { courseParam }),
  };
};
