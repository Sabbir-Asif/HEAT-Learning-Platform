export const authRealms = ["student", "admin"] as const;
export type AuthRealm = (typeof authRealms)[number];

export type UserRoleName = "SUPER_ADMIN" | "ADMIN" | "STUDENT";

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  familyId: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthenticatedSession {
  userId: string;
  familyId: string;
  realm: AuthRealm;
  role: UserRoleName;
  mustChangePassword: boolean;
}
