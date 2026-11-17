export const languages = ["en", "fr", "ar", "pt"] as const;
export type Language = (typeof languages)[number];

export function isLanguage(value: string): value is Language {
  return languages.some((language) => language === value);
}

export type MarketGuide = {
  description: string;
  intro: string;
  sections: readonly { heading: string; body: string }[];
  pilot: string;
};

export const marketResources = {
  NG: { name: "BPP — 2026 procurement guidance", url: "https://bpp-storage.s3.eu-west-2.amazonaws.com/wp-content/uploads/2026/10/29140354/Implementation-Guidelines-for-Procurement-Activities-Under-the-2026-Financial-Year.pdf" },
  GH: { name: "PPA", url: "https://ppa.gov.gh/online-documents/standard-tender-documents-revised/" },
  KE: { name: "NCA", url: "https://www.nca.go.ke/projects_registration-FAQs" },
  ZA: { name: "cidb", url: "https://www.cidb.org.za/contractors/register-of-contractors/requirements-for-grading/" },
  MA: { name: "Portail Marocain des Marchés Publics", url: "https://www.marchespublics.gov.ma/pmmp/guide.html?lang=fr" },
  CM: { name: "ARMP", url: "https://new.armp.cm/" },
} as const;

export type GuideMarketCode = keyof typeof marketResources;
export type MarketGuides = Record<GuideMarketCode, MarketGuide>;

export type MarketProfile = {
  code: string;
  resource: { name: string; url: string };
  content: Record<Language, { context: string; pilot: string }>;
};
