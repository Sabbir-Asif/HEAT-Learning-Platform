import { Inject, Injectable } from "@nestjs/common";
import { landingOverviewKey } from "@heat/contracts";
import type {
  AdminLandingOverviewResponse,
  LandingOverviewRequest,
  PublicLandingOverviewResponse,
} from "@heat/contracts";
import type { HeatClient, Prisma } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { MediaUrlService } from "../media";
import type { MediaAudience } from "../media";
import { landingCacheTag, PUBLIC_REVALIDATION } from "./public-revalidation";
import type { PublicRevalidation } from "./public-revalidation";
import {
  landingOverviewAssetIds,
  landingOverviewAudit,
  planLandingOverview,
  readStoredLandingOverview,
} from "./site-settings-rules";
import type { StoredLandingOverview } from "./site-settings-rules";

type SettingsClient = Pick<HeatClient, "siteSetting" | "mediaAsset">;

const linkedEntity = "SiteSetting";

const imageSelect = {
  id: true,
  key: true,
  kind: true,
  visibility: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  altText: true,
  variants: true,
  linkedEntity: true,
  linkedId: true,
} as const;

const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const invalidOverview = (path: string): ApiException =>
  new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [{ path, code: "invalid" }]);

@Injectable()
export class SiteSettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    private readonly media: MediaUrlService,
    @Inject(PUBLIC_REVALIDATION) private readonly revalidation: PublicRevalidation,
  ) {}

  async admin(): Promise<AdminLandingOverviewResponse> {
    const row = await this.database.siteSetting.findUnique({
      where: { key: landingOverviewKey },
      select: { value: true, updatedAt: true },
    });
    const response = await this.present(
      this.database,
      readStoredLandingOverview(row?.value),
      "admin",
    );
    return { ...response, updatedAt: row === null ? null : row.updatedAt.toISOString() };
  }

  async public(): Promise<PublicLandingOverviewResponse> {
    const row = await this.database.siteSetting.findUnique({
      where: { key: landingOverviewKey },
      select: { value: true },
    });
    return this.present(this.database, readStoredLandingOverview(row?.value), "student");
  }

  async update(request: LandingOverviewRequest): Promise<AdminLandingOverviewResponse> {
    const next = planLandingOverview(request);
    if (next === null) throw invalidOverview("body");
    const client = this.audit.client(this.database);
    const current = await client.siteSetting.findUnique({
      where: { key: landingOverviewKey },
      select: { value: true },
    });
    const previous = readStoredLandingOverview(current?.value);
    const saved = await client.siteSetting.upsert({
      where: { key: landingOverviewKey },
      create: { key: landingOverviewKey, value: asJson(next) },
      update: { value: asJson(next) },
      select: { id: true, updatedAt: true },
    });
    await this.linkAssets(client, saved.id, next);
    this.audit.capture({
      entityId: saved.id,
      before: landingOverviewAudit(previous),
      after: landingOverviewAudit(next),
    });
    this.audit.afterCommit(() => this.revalidation.revalidate([landingCacheTag]));
    const response = await this.present(client, next, "admin");
    return { ...response, updatedAt: saved.updatedAt.toISOString() };
  }

  private async linkAssets(
    client: SettingsClient,
    settingId: string,
    stored: StoredLandingOverview,
  ): Promise<void> {
    const ids = landingOverviewAssetIds(stored);
    if (ids.length === 0) return;
    const assets = await client.mediaAsset.findMany({
      where: { id: { in: ids }, deletedAt: null, kind: "IMAGE" },
      select: { id: true, linkedEntity: true, linkedId: true },
    });
    const usable = assets.filter(
      (asset) =>
        asset.linkedEntity === null ||
        (asset.linkedEntity === linkedEntity && asset.linkedId === settingId),
    );
    if (usable.length !== ids.length) throw invalidOverview("body");
    await client.mediaAsset.updateMany({
      where: { id: { in: ids }, linkedEntity: null },
      data: { linkedEntity, linkedId: settingId },
    });
  }

  private async present(
    client: SettingsClient,
    stored: StoredLandingOverview,
    audience: MediaAudience,
  ): Promise<PublicLandingOverviewResponse> {
    const ids = landingOverviewAssetIds(stored);
    const assets =
      ids.length === 0
        ? []
        : await client.mediaAsset.findMany({
            where: { id: { in: ids }, deletedAt: null },
            select: imageSelect,
          });
    const images = assets.map((asset) => ({
      assetId: asset.id,
      url: this.media.describe(asset, audience).url,
      alt: asset.altText ?? "",
    }));
    return {
      heading: stored.heading,
      schemaVersion: stored.schemaVersion,
      body: { ...stored.body },
      imageAssetId: stored.imageAssetId,
      image: images.find((image) => image.assetId === stored.imageAssetId) ?? null,
      images,
    };
  }
}
