/** The consultation section's anchor; the hero button scrolls to it. */
const CONSULTATION_ID = "book-a-consultation";

export type OwnerBenefitId = "payments" | "management" | "visibility";

export type OwnerPhaseId = "inception" | "construction" | "inspections" | "completion";

export const owners = {
  meta: {
    // What owners search for: building a house in Nigeria, often from abroad.
    title: "Build your home in Nigeria from anywhere",
    description:
      "Managed construction for homeowners and the diaspora: BuildPanda runs your build in Nigeria, with independent inspections and every stage, payment and report on the record for you to see.",
  },
  hero: {
    eyebrow: "Managed Construction Service",
    headline: "We help monitor your project from start to finish",
    body: "This is our managed construction service. BuildPanda runs your build, and every stage, payment certificate and inspection report goes on the record where you can read it. If you would rather run your own build, that is the software.",
    // Scrolls to the consultation form further down this page.
    action: { label: "Book Our Service", href: `#${CONSULTATION_ID}` },
    // A blueprint of a building going up. Compressed from a 20 MB GIF; the original is in assets-src/owners.
    video: { src: "/owners/build.mp4", poster: "/owners/build-poster.webp" },
  },
  eyes: {
    eyebrow: "Eyes on Ground",
    headline: ["We run the build,", "You see everything"],
    body: "BuildPanda pairs hands-on construction management with the software, so your project moves on time, on budget and in full view.",
    benefits: [
      {
        id: "payments",
        title: "Payment Accountability",
        description:
          "Every payment certificate traces back to work that was signed off. We record what was certified and what was paid.",
      },
      {
        id: "management",
        title: "Tech-enabled site management",
        description:
          "The software keeps every phase, contractor and key date on track, with costs and schedule updated as the work actually happens.",
      },
      {
        id: "visibility",
        title: "Real-time visibility, anywhere",
        description:
          "Daily logs, photos and progress stream to your dashboard, so you can follow what is happening without being on site.",
      },
    ] satisfies ReadonlyArray<{ id: OwnerBenefitId; title: string; description: string }>,
  },
  process: {
    eyebrow: "How we manage",
    headline: "A clear, accountable process at every phase",
    /** The phases of the managed service, in order. */
    phases: [
      {
        id: "inception",
        title: "Inception & planning",
        description:
          "We help you scope the project, set a realistic budget and schedule, and assemble the right professionals before work begins.",
        points: ["Scope, budget and timeline", "Design and documentation review", "Contractor selection"],
      },
      {
        id: "construction",
        title: "Construction & Monitoring",
        description:
          "Your build is managed day to day, with progress, costs and quality tracked openly and reported back to you.",
        points: [
          "Day-to-day site management",
          "Payment certificates against signed-off work",
          "Daily logs and site photos",
        ],
      },
      {
        id: "inspections",
        title: "Inspections",
        description:
          "An inspection is a job you ask for. A BuildPanda inspector attends and writes the report. The contractor being inspected can read that report and cannot change it.",
        points: [
          "Inspections you request, at the stages you choose",
          "A pass or fail outcome with findings and photos",
          "A re-inspection date when work has to be redone",
        ],
      },
      {
        id: "completion",
        title: "Completion",
        description:
          "We close the project out with you. The final work is signed off and you keep the full record of what was built, certified and paid.",
        points: [
          "Client sign-off on the final work",
          "The full certification and payment record",
          "Every drawing and document handed over",
        ],
      },
    ] satisfies ReadonlyArray<{
      id: OwnerPhaseId;
      title: string;
      description: string;
      points: ReadonlyArray<string>;
    }>,
  },
  types: {
    eyebrow: "What we manage",
    headline: "We manage all building project types",
    image: { width: 764, height: 398 },
    items: [
      {
        id: "new-homes",
        title: "New Homes",
        description: "Build a new family home from the ground up, managed end to end.",
        src: "/owners/type-new-homes.png",
        alt: "A newly built single-storey family home at dusk, with exterior wall lights on.",
      },
      {
        id: "renovations",
        title: "Renovations",
        description: "Renovate or extend an existing property with full cost control.",
        src: "/owners/type-renovations.png",
        alt: "A kitchen shown part finished, part as a line drawing, mid-renovation.",
      },
      {
        id: "investments",
        title: "Investments",
        description: "Develop property as an investment with transparent oversight.",
        src: "/owners/type-investments.png",
        alt: "Illustration of hands holding a costed sheet beside a rising arrow, a gauge and stacks of coins.",
      },
    ],
  },
  consultation: {
    id: CONSULTATION_ID,
    eyebrow: "Book a Consultation",
    headline: "Tell us about your project",
    body: "Tell us about the home you want to build. We will walk you through how BuildPanda manages your project from inception to handover, and answer every question, with no obligation",
    form: {
      firstName: { label: "First Name", placeholder: "Michael" },
      lastName: { label: "Last Name", placeholder: "Scott" },
      email: { label: "Email", placeholder: "name@mail.com" },
      phone: {
        label: "Phone Number",
        countryLabel: "Country code",
        hint: "Digits, spaces and hyphens, without the country code",
      },
      location: { label: "Build Location", placeholder: "City or area" },
      message: { label: "Tell us a little more", placeholder: "Give us some more details" },
      submit: "Book a Consultation",
      submitting: "Sending…",
      error: "That did not send. Check your connection and try again; what you typed is still here.",
      success: {
        title: "Thank you. We have your details.",
        body: "Someone from BuildPanda will be in touch to arrange your consultation.",
        again: "Send another enquiry",
      },
      // Sent with every enquiry: the lead endpoint requires a project type, and this page is about this service.
      projectType: "Managed construction service",
      source: "website:for-owners",
    },
  },
} as const;
