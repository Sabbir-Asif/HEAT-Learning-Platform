import { describe, expect, test } from "vitest";
import { sniffMediaType } from "../../src/media/media-sniff";

const bytes = (...values: number[]): Buffer => Buffer.from(values);
const padded = (head: Buffer): Buffer => Buffer.concat([head, Buffer.alloc(32)]);

const jpeg = padded(bytes(0xff, 0xd8, 0xff, 0xe0));
const png = padded(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
const webp = padded(Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBP", "latin1"));
const avif = padded(Buffer.concat([bytes(0, 0, 0, 0x1c), Buffer.from("ftypavif", "latin1")]));
const pdf = padded(Buffer.from("%PDF-1.7\n", "latin1"));
const docx = Buffer.concat([bytes(0x50, 0x4b, 0x03, 0x04), Buffer.from("word/document.xml")]);
const pptx = Buffer.concat([bytes(0x50, 0x4b, 0x03, 0x04), Buffer.from("ppt/presentation.xml")]);
const plainZip = Buffer.concat([bytes(0x50, 0x4b, 0x03, 0x04), Buffer.from("readme.txt")]);

describe("sniffMediaType", () => {
  test.each([
    ["jpeg", jpeg, "image/jpeg"],
    ["png", png, "image/png"],
    ["webp", webp, "image/webp"],
    ["avif", avif, "image/avif"],
    ["pdf", pdf, "application/pdf"],
    ["docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["pptx", pptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["vtt", Buffer.from("WEBVTT\n\n00:00.000 --> 00:01.000\nHi"), "text/vtt"],
    ["vtt with byte order mark", Buffer.from("﻿WEBVTT - title\n"), "text/vtt"],
  ])("detects %s from its bytes", (_name, content, expected) => {
    expect(sniffMediaType(content)).toBe(expected);
  });

  test.each([
    ["svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')],
    ["svg with xml prolog", Buffer.from('<?xml version="1.0"?><svg></svg>')],
    ["html", Buffer.from("<html><script>alert(1)</script></html>")],
    ["plain zip", plainZip],
    ["webvtt lookalike", Buffer.from("WEBVTTX\n")],
    ["empty", Buffer.alloc(0)],
    ["gif", Buffer.from("GIF89a")],
  ])("rejects %s", (_name, content) => {
    expect(sniffMediaType(content)).toBeNull();
  });

  test("ignores the file name entirely: a png is a png and never a pdf", () => {
    expect(sniffMediaType(png)).toBe("image/png");
  });
});
