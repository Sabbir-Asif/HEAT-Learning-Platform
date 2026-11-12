export type SniffedType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif"
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  | "text/vtt";

const startsWith = (bytes: Buffer, signature: number[], offset = 0): boolean =>
  bytes.length >= offset + signature.length &&
  signature.every((value, index) => bytes[offset + index] === value);

const ascii = (bytes: Buffer, start: number, end: number): string =>
  bytes.subarray(start, end).toString("latin1");

const zipSignature = [0x50, 0x4b, 0x03, 0x04];
const wordMarker = Buffer.from("word/document.xml");
const slideMarker = Buffer.from("ppt/presentation.xml");
const avifBrands = new Set(["avif", "avis"]);
const byteOrderMark = [0xef, 0xbb, 0xbf];
const vttHeader = "WEBVTT";
const vttTerminators = new Set([undefined, " ", "\t", "\n", "\r"]);

const isAvif = (bytes: Buffer): boolean =>
  ascii(bytes, 4, 8) === "ftyp" && avifBrands.has(ascii(bytes, 8, 12));

const isWebp = (bytes: Buffer): boolean =>
  ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";

const isVtt = (bytes: Buffer): boolean => {
  const offset = startsWith(bytes, byteOrderMark) ? byteOrderMark.length : 0;
  const text = ascii(bytes, offset, offset + vttHeader.length + 1);
  return text.startsWith(vttHeader) && vttTerminators.has(text[vttHeader.length]);
};

const officeType = (bytes: Buffer): SniffedType | null => {
  if (bytes.includes(wordMarker)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (bytes.includes(slideMarker)) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  return null;
};

export const sniffMediaType = (bytes: Buffer): SniffedType | null => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (isWebp(bytes)) return "image/webp";
  if (isAvif(bytes)) return "image/avif";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWith(bytes, zipSignature)) return officeType(bytes);
  if (isVtt(bytes)) return "text/vtt";
  return null;
};

export const isImageType = (type: SniffedType): boolean => type.startsWith("image/");
