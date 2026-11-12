export type CandidateFile = { name: string; size: number; type: string };

export type UploadRules = {
  extensions: readonly string[];
  mimeTypes: readonly string[];
  maxBytes: number;
  maxFiles: number;
};

export type FileRejection = "name" | "empty" | "type" | "size" | "duplicate" | "count";

export type FileCheck = { ok: true } | { ok: false; reason: FileRejection; message: string };

const mebibyte = 1024 * 1024;
const maxNameLength = 120;

export const imageRules: UploadRules = {
  extensions: ["jpg", "jpeg", "png", "webp"],
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxBytes: 5 * mebibyte,
  maxFiles: 5,
};

export const documentRules: UploadRules = {
  extensions: ["pdf", "doc", "docx"],
  mimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  maxBytes: 10 * mebibyte,
  maxFiles: 5,
};

export const captionRules: UploadRules = {
  extensions: ["vtt"],
  mimeTypes: ["text/vtt"],
  maxBytes: mebibyte,
  maxFiles: 1,
};

export const videoRules = (maxBytes: number): UploadRules => ({
  extensions: ["mp4", "mov", "webm", "mkv"],
  mimeTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"],
  maxBytes,
  maxFiles: 1,
});

export function formatBytes(bytes: number): string {
  if (bytes >= mebibyte) return `${Number((bytes / mebibyte).toFixed(1))} MB`;
  if (bytes >= 1024) return `${Number((bytes / 1024).toFixed(1))} KB`;
  return `${bytes} B`;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function hasUnsafeName(name: string): boolean {
  if (name.length === 0 || name.length > maxNameLength) return true;
  return [...name].some((char) => char === "/" || char === "\\" || char.charCodeAt(0) < 32);
}

function reject(reason: FileRejection, message: string): FileCheck {
  return { ok: false, reason, message };
}

export function checkFile(
  file: CandidateFile,
  rules: UploadRules,
  existing: readonly CandidateFile[],
): FileCheck {
  if (hasUnsafeName(file.name)) return reject("name", "This file name is not allowed.");
  if (file.size === 0) return reject("empty", "This file is empty.");

  const typeAllowed =
    rules.extensions.includes(extensionOf(file.name)) &&
    (file.type === "" || rules.mimeTypes.includes(file.type));
  if (!typeAllowed) {
    const allowed = rules.extensions.map((extension) => extension.toUpperCase()).join(", ");
    return reject("type", `Allowed file types: ${allowed}.`);
  }

  if (file.size > rules.maxBytes) {
    return reject("size", `Files can be at most ${formatBytes(rules.maxBytes)}.`);
  }
  if (existing.some((other) => other.name === file.name && other.size === file.size)) {
    return reject("duplicate", "This file is already in the list.");
  }
  if (existing.length >= rules.maxFiles) {
    return reject("count", `You can add at most ${rules.maxFiles} files.`);
  }
  return { ok: true };
}
