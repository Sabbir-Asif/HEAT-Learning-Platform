import { loadCertificateConfig, type CertificateConfig } from "./certificate-config";
import { certificateLogos } from "./certificate-logos";
import { nameFontSizePx } from "./certificate-name-fit";
import { buildVerifyUrl, renderQrSvg } from "./certificate-qr";
import { certificateColors as color, certificateFonts as font } from "./certificate-theme";
import { escapeHtml } from "./escape-html";

export interface CertificateRenderData {
  holderName: string;
  courseTitle: string;
  completedAt: Date;
  number: string;
}

const completionDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatCompletionDate = (date: Date): string => completionDateFormat.format(date);

const defaultConfig = (): CertificateConfig => loadCertificateConfig({});

const styles = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${color.card}; color: ${color.foreground}; font-family: ${font.body}; }
.page { width: 297mm; height: 210mm; padding: 10mm; overflow: hidden; page-break-after: avoid; page-break-inside: avoid; }
.frame { height: 100%; border: 1.2mm solid ${color.primary}; padding: 2mm; }
.inner { height: 100%; border: 0.3mm solid ${color.accent}; background: ${color.background}; padding: 8mm 14mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
.logos { display: flex; align-items: center; justify-content: center; gap: 14mm; height: 22mm; }
.logos img { height: 22mm; width: auto; max-width: 30mm; object-fit: contain; }
.organisation { margin: 3mm 0 0; font-size: 11pt; font-weight: 600; color: ${color.primary}; letter-spacing: 0.04em; text-transform: uppercase; }
.title { margin: 5mm 0 0; font-family: ${font.display}; font-size: 30pt; font-weight: 700; color: ${color.primary}; }
.lead { margin: 5mm 0 0; font-size: 12pt; color: ${color.mutedForeground}; }
.holder { width: 100%; margin: 3mm 0 0; padding-bottom: 2mm; border-bottom: 0.4mm solid ${color.sidebarPrimary}; font-family: ${font.display}; font-weight: 700; color: ${color.foreground}; line-height: 1.15; overflow-wrap: anywhere; word-break: break-word; max-height: 30mm; overflow: hidden; }
.course { margin: 3mm 0 0; font-family: ${font.display}; font-size: 20pt; font-weight: 600; color: ${color.primary}; overflow-wrap: anywhere; max-height: 24mm; overflow: hidden; }
.date { margin: 3mm 0 0; font-size: 12pt; color: ${color.mutedForeground}; }
.footer { margin-top: auto; width: 100%; display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm; }
.verify { display: flex; align-items: center; gap: 4mm; text-align: left; max-width: 100mm; }
.qr { width: 26mm; height: 26mm; flex: none; }
.qr svg { width: 100%; height: 100%; display: block; }
.verify-text { font-size: 8pt; color: ${color.mutedForeground}; overflow-wrap: anywhere; }
.verify-text strong { display: block; margin-top: 1mm; font-size: 10pt; color: ${color.foreground}; letter-spacing: 0.06em; }
.signatories { display: flex; gap: 10mm; }
.signatory { width: 55mm; border-top: 0.3mm solid ${color.foreground}; padding-top: 1.5mm; font-size: 9pt; color: ${color.mutedForeground}; }
.signatory strong { display: block; font-size: 10pt; color: ${color.foreground}; }
.address { margin: 3mm 0 0; font-size: 8pt; color: ${color.mutedForeground}; }
`;

const signatoryBlock = (name: string, title: string): string =>
  `<div class="signatory"><strong>${escapeHtml(name)}</strong>${escapeHtml(title)}</div>`;

export const renderCertificateHtml = (
  data: CertificateRenderData,
  config: CertificateConfig = defaultConfig(),
): string => {
  const verifyUrl = buildVerifyUrl(config.verifyBaseUrl, data.number);
  const qr = renderQrSvg(verifyUrl, color.foreground, color.card);
  const logos = [
    ["HEAT Project", certificateLogos.heat],
    ["University Grants Commission of Bangladesh", certificateLogos.ugc],
    ["University of Dhaka", certificateLogos.du],
  ]
    .map(([label, source]) => `<img src="${source}" alt="${escapeHtml(label ?? "")}">`)
    .join("");
  const [first, second] = config.signatories;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(config.wording.title)}</title>`,
    `<style>${styles}</style>`,
    "</head>",
    "<body>",
    '<main class="page"><div class="frame"><div class="inner">',
    `<div class="logos">${logos}</div>`,
    `<p class="organisation">${escapeHtml(config.organisation.name)}</p>`,
    `<h1 class="title">${escapeHtml(config.wording.title)}</h1>`,
    `<p class="lead">${escapeHtml(config.wording.intro)}</p>`,
    `<p class="holder" style="font-size: ${nameFontSizePx(data.holderName)}px">${escapeHtml(data.holderName)}</p>`,
    `<p class="lead">${escapeHtml(config.wording.completion)}</p>`,
    `<p class="course">${escapeHtml(data.courseTitle)}</p>`,
    `<p class="date">${escapeHtml(formatCompletionDate(data.completedAt))}</p>`,
    '<div class="footer">',
    `<div class="verify"><div class="qr">${qr}</div><div class="verify-text">${escapeHtml(config.wording.verifyLabel)} ${escapeHtml(verifyUrl)}<strong>${escapeHtml(data.number)}</strong></div></div>`,
    `<div class="signatories">${signatoryBlock(first.name, first.title)}${signatoryBlock(second.name, second.title)}</div>`,
    "</div>",
    `<p class="address">${escapeHtml(config.organisation.address)}</p>`,
    "</div></div></main>",
    "</body>",
    "</html>",
  ].join("\n");
};
