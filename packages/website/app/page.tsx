import { Faq } from "@/components/sections/faq/faq";
import { Fragmentation } from "@/components/sections/fragmentation/fragmentation";
import { Hero } from "@/components/sections/hero/hero";
import { Site } from "@/components/sections/site/site";
import { Takeoff } from "@/components/sections/takeoff/takeoff";
import { Workspace } from "@/components/sections/workspace/workspace";

export default function HomePage() {
  return (
    <main id="main">
      <Hero />
      <Fragmentation />
      <Takeoff />
      <Site />
      <Workspace />
      <Faq structuredData />
    </main>
  );
}
