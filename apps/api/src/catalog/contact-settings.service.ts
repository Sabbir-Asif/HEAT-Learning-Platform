import { Inject, Injectable } from "@nestjs/common";
import { contactCacheTag, contactSettingsKey } from "@heat/contracts";
import type {
  AdminContactSettingsResponse,
  ContactSettingsRequest,
  PublicContactSettingsResponse,
} from "@heat/contracts";
import type { HeatClient, Prisma } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { PUBLIC_REVALIDATION } from "./public-revalidation";
import type { PublicRevalidation } from "./public-revalidation";
import { readStoredContactSettings } from "./contact-settings-rules";

const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class ContactSettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    @Inject(PUBLIC_REVALIDATION) private readonly revalidation: PublicRevalidation,
  ) {}

  async admin(): Promise<AdminContactSettingsResponse> {
    const row = await this.database.siteSetting.findUnique({
      where: { key: contactSettingsKey },
      select: { value: true, updatedAt: true },
    });
    return {
      ...readStoredContactSettings(row?.value),
      updatedAt: row === null ? null : row.updatedAt.toISOString(),
    };
  }

  async public(): Promise<PublicContactSettingsResponse> {
    const row = await this.database.siteSetting.findUnique({
      where: { key: contactSettingsKey },
      select: { value: true },
    });
    return readStoredContactSettings(row?.value);
  }

  async update(request: ContactSettingsRequest): Promise<AdminContactSettingsResponse> {
    const client = this.audit.client(this.database);
    const current = await client.siteSetting.findUnique({
      where: { key: contactSettingsKey },
      select: { value: true },
    });
    const saved = await client.siteSetting.upsert({
      where: { key: contactSettingsKey },
      create: { key: contactSettingsKey, value: asJson(request) },
      update: { value: asJson(request) },
      select: { id: true, updatedAt: true },
    });
    this.audit.capture({
      entityId: saved.id,
      before: readStoredContactSettings(current?.value),
      after: request,
    });
    this.audit.afterCommit(() => this.revalidation.revalidate([contactCacheTag]));
    return { ...request, updatedAt: saved.updatedAt.toISOString() };
  }
}
