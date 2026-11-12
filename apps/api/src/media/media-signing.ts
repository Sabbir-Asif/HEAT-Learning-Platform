import { createHmac } from "node:crypto";

export const mediaSigningInput = (path: string, expiry: number): string => `${path}\n${expiry}`;

export const mediaSignature = (secret: string, path: string, expiry: number): string =>
  createHmac("sha256", secret).update(mediaSigningInput(path, expiry)).digest("hex");

export const signedMediaUrl = (
  keyId: string,
  secret: string,
  path: string,
  expiry: number,
): string => `${path}?k=${keyId}&e=${expiry}&s=${mediaSignature(secret, path, expiry)}`;
