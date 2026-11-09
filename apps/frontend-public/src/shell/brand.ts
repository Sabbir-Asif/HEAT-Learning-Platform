import type { LogoSource } from "@heat/ui/shell";

export const heatLogo: LogoSource = {
  src: "/brand/heat.svg",
  darkSrc: "/brand/heat-dark.svg",
  alt: "HEAT project logo",
};

export const crestLogo: LogoSource = {
  src: "/brand/du-crest.svg",
  darkSrc: "/brand/du-crest-dark.svg",
  alt: "University of Dhaka crest",
};

export const partnerLogos: LogoSource[] = [
  { src: "/brand/gob.svg", darkSrc: "/brand/gob.svg", alt: "Government of Bangladesh" },
  { src: "/brand/ugc.svg", darkSrc: "/brand/ugc-dark.svg", alt: "University Grants Commission" },
  {
    src: "/brand/world-bank.svg",
    darkSrc: "/brand/world-bank-dark.svg",
    alt: "The World Bank",
  },
];

export const siteName = "HEAT Safety Training";
