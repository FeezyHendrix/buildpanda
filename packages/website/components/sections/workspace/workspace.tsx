import { EyebrowPill } from "@/components/ui/eyebrow-pill";
import { Section } from "@/components/ui/section";
import { workspace } from "@/content/workspace";
import { WorkspaceGrid } from "./workspace-grid";

/** Run the project: the nine things the team works with, all on one record. */
export function Workspace() {
  const { headline } = workspace;

  return (
    <Section theme="brand" className="relative">
      <div aria-hidden="true" className="grain" />

      <div className="site-container relative pt-16 pb-16 lg:pt-20 lg:pb-28">
        <div className="mx-auto flex max-w-[44rem] flex-col items-center text-center">
          <EyebrowPill>{workspace.eyebrow}</EyebrowPill>
          <h2 className="mt-4 text-[clamp(2rem,1.2rem+2.9vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
            {headline.lead} <span className="text-white/55">{headline.accent}</span>
          </h2>
          <p className="mt-4 max-w-[33rem] leading-normal text-pretty md:text-[1.0625rem]">{workspace.body}</p>
        </div>

        <div className="mt-12 lg:mt-20">
          <WorkspaceGrid />
        </div>
      </div>
    </Section>
  );
}
