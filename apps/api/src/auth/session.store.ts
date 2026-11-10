export type RealmName = "STUDENT" | "ADMIN";

export interface SessionRow {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export interface SessionUserRow {
  id: string;
  realm: RealmName;
  role: "SUPER_ADMIN" | "ADMIN" | "STUDENT";
  deactivatedAt: Date | null;
  deletedAt: Date | null;
  mustChangePassword: boolean;
}

export interface NewSession {
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export abstract class SessionStore {
  abstract findByHash(refreshTokenHash: string): Promise<SessionRow | null>;
  abstract findLatest(familyId: string): Promise<SessionRow | null>;
  abstract findFamilyStart(familyId: string): Promise<Date | null>;
  abstract findUser(userId: string): Promise<SessionUserRow | null>;
  abstract insert(session: NewSession): Promise<void>;
  abstract rotate(previousId: string, rotatedAt: Date, next: NewSession): Promise<boolean>;
  abstract revokeFamily(familyId: string, at: Date): Promise<void>;
  abstract revokeUser(userId: string, at: Date): Promise<void>;
  abstract revokeUserExcept(userId: string, keepFamilyId: string, at: Date): Promise<void>;
}
