import { randomUUID } from "node:crypto";
import type { Clock } from "../../src/core";
import { RotationClaimStore } from "../../src/auth/rotation-claim.store";
import { SessionStore } from "../../src/auth/session.store";
import type { NewSession, SessionRow, SessionUserRow } from "../../src/auth/session.store";

export class FakeClock implements Clock {
  private current: number;

  constructor(start: Date = new Date("2026-11-09T04:00:00.000Z")) {
    this.current = start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceSeconds(seconds: number): void {
    this.current += seconds * 1000;
  }

  advanceMinutes(minutes: number): void {
    this.advanceSeconds(minutes * 60);
  }
}

export class InMemoryClaimStore extends RotationClaimStore {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly clock: Clock) {
    super();
  }

  claim(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (this.live(key) !== null) return Promise.resolve(false);
    this.entries.set(key, { value, expiresAt: this.clock.now().getTime() + ttlSeconds * 1000 });
    return Promise.resolve(true);
  }

  read(key: string): Promise<string | null> {
    return Promise.resolve(this.live(key));
  }

  delete(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }

  private live(key: string): string | null {
    const entry = this.entries.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt <= this.clock.now().getTime()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }
}

export class InMemorySessionStore extends SessionStore {
  readonly rows: SessionRow[] = [];
  readonly users = new Map<string, SessionUserRow>();
  failNextRotation: Error | null = null;
  rotateResult: boolean | null = null;

  addUser(user: Partial<SessionUserRow> = {}): SessionUserRow {
    const created: SessionUserRow = {
      id: randomUUID(),
      realm: "STUDENT",
      role: "STUDENT",
      deactivatedAt: null,
      deletedAt: null,
      mustChangePassword: false,
      ...user,
    };
    this.users.set(created.id, created);
    return created;
  }

  findByHash(refreshTokenHash: string): Promise<SessionRow | null> {
    return Promise.resolve(
      this.rows.find((row) => row.refreshTokenHash === refreshTokenHash) ?? null,
    );
  }

  findLatest(familyId: string): Promise<SessionRow | null> {
    const family = this.rows.filter((row) => row.familyId === familyId);
    return Promise.resolve(family.at(-1) ?? null);
  }

  findUser(userId: string): Promise<SessionUserRow | null> {
    return Promise.resolve(this.users.get(userId) ?? null);
  }

  insert(session: NewSession): Promise<void> {
    this.rows.push(this.toRow(session));
    return Promise.resolve();
  }

  rotate(previousId: string, rotatedAt: Date, next: NewSession): Promise<boolean> {
    if (this.failNextRotation !== null) {
      const error = this.failNextRotation;
      this.failNextRotation = null;
      return Promise.reject(error);
    }
    if (this.rotateResult !== null) return Promise.resolve(this.rotateResult);
    const previous = this.rows.find((row) => row.id === previousId);
    if (previous === undefined || previous.rotatedAt !== null || previous.revokedAt !== null) {
      return Promise.resolve(false);
    }
    previous.rotatedAt = rotatedAt;
    this.rows.push(this.toRow(next));
    return Promise.resolve(true);
  }

  revokeFamily(familyId: string, at: Date): Promise<void> {
    this.revokeWhere((row) => row.familyId === familyId, at);
    return Promise.resolve();
  }

  revokeUser(userId: string, at: Date): Promise<void> {
    this.revokeWhere((row) => row.userId === userId, at);
    return Promise.resolve();
  }

  revokeUserExcept(userId: string, keepFamilyId: string, at: Date): Promise<void> {
    this.revokeWhere((row) => row.userId === userId && row.familyId !== keepFamilyId, at);
    return Promise.resolve();
  }

  private revokeWhere(match: (row: SessionRow) => boolean, at: Date): void {
    for (const row of this.rows) {
      if (match(row) && row.revokedAt === null) row.revokedAt = at;
    }
  }

  private toRow(session: NewSession): SessionRow {
    return {
      id: randomUUID(),
      userId: session.userId,
      familyId: session.familyId,
      refreshTokenHash: session.refreshTokenHash,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      rotatedAt: null,
      revokedAt: null,
    };
  }
}
