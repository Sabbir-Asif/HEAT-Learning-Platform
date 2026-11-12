const formulaTriggers = new Set(["=", "+", "-", "@", "\t", "\r"]);
const quotedCharacters = /[",\r\n]/;

export const csvByteOrderMark = "﻿";
export const csvLineBreak = "\r\n";

export const neutraliseFormula = (value: string): string =>
  value !== "" && formulaTriggers.has(value.charAt(0)) ? `'${value}` : value;

export const csvCell = (value: string): string => {
  const safe = neutraliseFormula(value);
  return quotedCharacters.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const csvLine = (cells: readonly string[]): string =>
  `${cells.map(csvCell).join(",")}${csvLineBreak}`;
