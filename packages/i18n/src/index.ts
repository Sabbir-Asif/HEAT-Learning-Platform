import { brand as bnBrand } from "./messages/bn/brand";
import { brand as enBrand } from "./messages/en/brand";

export const packageName = "@heat/i18n";

export { compareKeys, flattenKeys } from "./keys";
export type { Catalog } from "./keys";

export const messages = {
  en: { brand: enBrand },
  bn: { brand: bnBrand },
};
