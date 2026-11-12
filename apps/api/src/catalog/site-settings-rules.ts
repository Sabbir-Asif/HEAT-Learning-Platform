import { parseRichText, richTextImageIds } from "@heat/contracts";
import type { LandingOverviewRequest, RichTextDoc } from "@heat/contracts";

export interface StoredLandingOverview {
  heading: string;
  schemaVersion: number;
  body: RichTextDoc;
  imageAssetId: string | null;
}

export const emptyLandingOverview: StoredLandingOverview = {
  heading: "",
  schemaVersion: 1,
  body: { type: "doc", content: [] },
  imageAssetId: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readStoredLandingOverview = (value: unknown): StoredLandingOverview => {
  if (!isRecord(value)) return emptyLandingOverview;
  const parsed = parseRichText(value.body);
  return {
    heading: typeof value.heading === "string" ? value.heading : "",
    schemaVersion: typeof value.schemaVersion === "number" ? value.schemaVersion : 1,
    body: parsed.ok ? parsed.doc : emptyLandingOverview.body,
    imageAssetId: typeof value.imageAssetId === "string" ? value.imageAssetId : null,
  };
};

export const landingOverviewAssetIds = (stored: StoredLandingOverview): string[] => {
  const ids = [...richTextImageIds(stored.body)];
  if (stored.imageAssetId !== null) ids.push(stored.imageAssetId);
  return [...new Set(ids)];
};

export const planLandingOverview = (
  request: LandingOverviewRequest,
): StoredLandingOverview | null => {
  const parsed = parseRichText(request.body);
  if (!parsed.ok) return null;
  return {
    heading: request.heading,
    schemaVersion: request.schemaVersion,
    body: parsed.doc,
    imageAssetId: request.imageAssetId,
  };
};

export const landingOverviewAudit = (stored: StoredLandingOverview) => ({
  heading: stored.heading,
  body: stored.body,
  imageAssetId: stored.imageAssetId,
});
