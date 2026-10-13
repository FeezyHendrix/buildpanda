export type GuideSection = {
  heading: string;
  paragraphs: ReadonlyArray<string>;
  bullets?: ReadonlyArray<string>;
};

export type Guide = {
  slug: string;
  /** The search result title; the brand is appended by the layout. */
  title: string;
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
