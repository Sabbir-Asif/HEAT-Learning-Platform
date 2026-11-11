import QRCode from "qrcode";
import { certificateNumberPattern } from "./certificate-number";

const quietZoneModules = 4;

export const buildVerifyUrl = (baseUrl: string, number: string): string => {
  if (!certificateNumberPattern.test(number)) throw new Error("invalid certificate number");
  const base = new URL(baseUrl);
  return `${base.origin}/verify/${number}`;
};

export const renderQrSvg = (payload: string, color: string, background: string): string => {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const size = modules.size;
  const total = size + quietZoneModules * 2;
  const segments: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (modules.get(row, column)) {
        segments.push(`M${column + quietZoneModules} ${row + quietZoneModules}h1v1h-1z`);
      }
    }
  }
  return [
    `<svg viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" role="img" aria-label="QR code to verify this certificate" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="${background}"/>`,
    `<path d="${segments.join("")}" fill="${color}"/>`,
    "</svg>",
  ].join("");
};
