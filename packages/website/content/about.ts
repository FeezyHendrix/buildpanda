export type ValueId = "trust" | "money" | "distance" | "people";

export const about = {
  meta: {
    title: "About BuildPanda",
    description:
      "BuildPanda is a Lagos construction and technology company making building in Africa transparent and accountable, for contractors who run projects and owners who pay for them.",
  },
  hero: {
    eyebrow: "About Us",
    headline: "We are building trust into how homes get built",
    body: "BuildPanda is a construction and technology company on a mission to make building a home transparent, accountable and stress-free, whether you are on site or following the project from a distance.",
    illustration: { src: "/about/buildings.svg", width: 219, height: 204 },
  },
  story: {
    eyebrow: "Our Story",
    headline: "Born from a simple, painful question",
    paragraphs: [
      "Too many people who want to build a home face the same problem: they do not know who to trust. Money is sent, promises are made, and months later the project looks nothing like the plan, or the budget.",
      "It is even harder when you cannot be on site. Building a home should be a source of pride, but distance can turn every update into a leap of faith.",
      "BuildPanda was created to change that. We sell software a contractor runs their own build on, and a managed construction service where we run the build. Both put every stage, payment certificate and inspection report on one record you can read.",
    ],
    image: {
      src: "/about/story.png",
      width: 1036,
      height: 1000,
      alt: "Illustration of a site manager in a hard hat and high-visibility vest standing on a hill with a tablet, looking out over a building site and a distant city.",
    },
  },
  values: {
    eyebrow: "Our Values",
    headline: "The principles behind every project we manage",
    items: [
      {
        id: "trust",
        title: "Trust through transparency",
        description:
          "We replace rumours and guesswork with verified progress, honest inspections and clear records.",
      },
      {
        id: "money",
        title: "Accountability with money",
        description: "We record what was certified and what was paid, so you can account for the project budget.",
      },
      {
        id: "distance",
        title: "Distance is no barrier",
        description:
          "We build for people who are far from the site, so visibility and communication are never an afterthought.",
      },
      {
        id: "people",
        title: "People first",
        description: "Behind every project is a family and a dream. We manage builds with the care that deserves.",
      },
    ] satisfies ReadonlyArray<{ id: ValueId; title: string; description: string }>,
  },
} as const;
