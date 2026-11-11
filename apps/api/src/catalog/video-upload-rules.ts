import { tusProtocol, videoUploadLimits } from "@heat/contracts";
import { ApiException } from "../http/api-exception";

const digits = /^\d{1,15}$/;
const keyBytes = 24;
const hourMilliseconds = 3_600_000;
const ftypOffset = 4;
const ebmlSignature = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const ftypSignature = Buffer.from("ftyp");

export type RandomBytes = (size: number) => Buffer;

export const parseUploadLength = (header: string | undefined, maxBytes: number): number => {
  if (header === undefined || !digits.test(header)) throw new ApiException(400, "BAD_REQUEST");
  const length = Number(header);
  if (length > maxBytes) throw new ApiException(413, "UPLOAD_TOO_LARGE");
  if (length < videoUploadLimits.minBytes) throw new ApiException(415, "UPLOAD_TYPE_NOT_ALLOWED");
  return length;
};

export const parseUploadOffset = (header: string | undefined): number => {
  if (header === undefined || !digits.test(header)) throw new ApiException(400, "BAD_REQUEST");
  return Number(header);
};

export const assertTusVersion = (header: string | undefined): void => {
  if (header !== tusProtocol.version) throw new ApiException(412, "BAD_REQUEST");
};

export const assertContentType = (header: string | undefined): void => {
  if (header !== tusProtocol.offsetContentType) {
    throw new ApiException(415, "UPLOAD_TYPE_NOT_ALLOWED");
  }
};

export const assertOffsetMatches = (serverOffset: number, clientOffset: number): void => {
  if (serverOffset !== clientOffset) throw new ApiException(409, "UPLOAD_OFFSET_MISMATCH");
};

export const isVideoSignature = (head: Buffer): boolean => {
  if (head.length < videoUploadLimits.minBytes) return false;
  if (head.subarray(0, ebmlSignature.length).equals(ebmlSignature)) return true;
  return head.subarray(ftypOffset, ftypOffset + ftypSignature.length).equals(ftypSignature);
};

export const assertVideoBytes = (head: Buffer): void => {
  if (!isVideoSignature(head)) throw new ApiException(415, "UPLOAD_TYPE_NOT_ALLOWED");
};

export const isUploadExpired = (createdAt: Date, now: Date, expiryHours: number): boolean =>
  now.getTime() - createdAt.getTime() > expiryHours * hourMilliseconds;

export const newAssetKey = (random: RandomBytes): string => random(keyBytes).toString("base64url");
