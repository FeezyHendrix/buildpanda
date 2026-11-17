export type GuideSection = {
  heading: string;
  paragraphs: ReadonlyArray<string>;
  bullets?: ReadonlyArray<string>;
};

export type Guide = {
  slug: string;
  /** Article heading, also used in guide lists and structured data. */
  title: string;
  /** Concise search title; the layout appends the brand. */
  seoTitle: string;
  description: string;
  /** Who it is for, shown above the headline. */
  audience: "Contractors" | "Owners" | "Site teams";
  published: string;
  updated?: string;
  minutes: number;
  intro: ReadonlyArray<string>;
  sections: ReadonlyArray<GuideSection>;
  /** Closing call to action: where a reader who is ready goes next. */
  next: { label: string; href: string };
};
