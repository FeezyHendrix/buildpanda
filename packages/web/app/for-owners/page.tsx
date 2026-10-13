import type { Metadata } from "next";
import { OwnersConsultation } from "@/components/sections/owners/owners-consultation";
import { OwnersEyes } from "@/components/sections/owners/owners-eyes";
import { OwnersHero } from "@/components/sections/owners/owners-hero";
import { OwnersProcess } from "@/components/sections/owners/owners-process";
import { OwnersTypes } from "@/components/sections/owners/owners-types";
import { owners } from "@/content/owners";

export const metadata: Metadata = {
  title: owners.meta.title,
  description: owners.meta.description,
};

export default function OwnersPage() {
  return (
    <main id="main">
      <OwnersHero />
      <OwnersEyes />
      <OwnersProcess />
      <OwnersTypes />
      <OwnersConsultation />
    </main>
  );
}
