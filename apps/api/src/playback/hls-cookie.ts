import { createHmac } from "node:crypto";
import { hlsCookiePath } from "@heat/contracts";

export const hlsSigningInput = (videoId: string, expiry: number): string =>
  `${videoId}\n${hlsCookiePath(videoId)}\n${expiry}`;

export const hlsSignature = (secret: string, videoId: string, expiry: number): string =>
  createHmac("sha256", secret).update(hlsSigningInput(videoId, expiry)).digest("hex");

export const issueHlsCookieValue = (
  keyId: string,
  secret: string,
  videoId: string,
  expiry: number,
): string => `${keyId}.${expiry}.${hlsSignature(secret, videoId, expiry)}`;
