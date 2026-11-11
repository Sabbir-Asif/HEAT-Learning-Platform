export const nameBaseFontPx = 44;
export const nameMinFontPx = 20;
const fullSizeMaxLength = 30;

export const nameFontSizePx = (name: string): number => {
  const length = Array.from(name).length;
  if (length <= fullSizeMaxLength) return nameBaseFontPx;
  return Math.max(nameMinFontPx, Math.round((nameBaseFontPx * fullSizeMaxLength) / length));
};
