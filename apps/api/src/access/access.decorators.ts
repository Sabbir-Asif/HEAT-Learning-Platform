import { SetMetadata } from "@nestjs/common";
import type { AuthRealm, UserRoleName } from "../auth";

export const AUDIENCE_KEY = "access:audience";
export const ROLES_KEY = "access:roles";
export const COURSE_ACCESS_KEY = "access:courseParam";

export const Audience = (audience: AuthRealm): MethodDecorator & ClassDecorator =>
  SetMetadata(AUDIENCE_KEY, audience);

export const Roles = (...roles: UserRoleName[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

export const RequireCourseAccess = (courseParam = "courseId"): MethodDecorator & ClassDecorator =>
  SetMetadata(COURSE_ACCESS_KEY, courseParam);
