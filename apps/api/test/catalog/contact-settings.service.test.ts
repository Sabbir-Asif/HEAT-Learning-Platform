import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { ContactSettingsService } from "../../src/catalog/contact-settings.service";

const settingId = "0198f1a0-0000-7000-8000-0000000000e2";
const at = new Date("2026-11-12T06:00:00.000Z");

const details = {
  organisation: "HEAT office",
  address: "Room 12, TSC",
  email: "heat@du.ac.bd",
  phone: "+880 2 5566 7788",
  officeHours: "Sunday to Thursday, 9:00 to 17:00",
};

const build = (stored?: unknown) => {
  const database = {
    siteSetting: {
      findUnique: vi
        .fn()
        .mockResolvedValue(stored === undefined ? null : { value: stored, updatedAt: at }),
      upsert: vi.fn().mockResolvedValue({ id: settingId, updatedAt: at }),
    },
  };
  const revalidate = vi.fn().mockResolvedValue(undefined);
  const service = new ContactSettingsService(database as never, new AuditService({} as never), {
    revalidate,
  } as never);
  const changes: AuditChange[] = [];
  const afterCommit: Array<() => Promise<void>> = [];
  const scope = { tx: database as never, changes, afterCommit, skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, afterCommit, revalidate, inAuditScope };
};

describe("ContactSettingsService reads", () => {
  test("returns empty details before anything is saved", async () => {
    const { service } = build();
    expect(await service.public()).toEqual({
      organisation: "",
      address: "",
      email: "",
      phone: "",
      officeHours: "",
    });
    expect((await service.admin()).updatedAt).toBeNull();
  });

  test("returns the stored details as entered", async () => {
    const { service } = build(details);
    expect(await service.public()).toEqual(details);
    expect(await service.admin()).toEqual({ ...details, updatedAt: at.toISOString() });
  });

  test("falls back to empty details when the stored value is malformed", async () => {
    const { service } = build({ email: 42 });
    expect((await service.public()).email).toBe("");
  });
});

describe("ContactSettingsService.update", () => {
  test("stores the details, audits before and after and revalidates the contact tag", async () => {
    const { service, database, changes, afterCommit, revalidate, inAuditScope } = build({
      ...details,
      email: "old@du.ac.bd",
    });
    const result = await inAuditScope(() => service.update(details));
    expect(database.siteSetting.upsert).toHaveBeenCalledOnce();
    expect(result).toEqual({ ...details, updatedAt: at.toISOString() });
    expect(changes[0]?.before).toMatchObject({ email: "old@du.ac.bd" });
    expect(changes[0]?.after).toMatchObject({ email: "heat@du.ac.bd" });
    await afterCommit[0]?.();
    expect(revalidate).toHaveBeenCalledWith(["contact"]);
  });
});
