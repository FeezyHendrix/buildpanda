import { LogoMark } from "@/components/ui/logo";

/** Panda AI, sitting on the line between the drawing and the sheet it produces. Decorative. */
export function AiMarker() {
  return (
    <div aria-hidden="true" className="relative flex h-22 w-14 items-center justify-center justify-self-center lg:h-auto lg:self-stretch">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/14 lg:-inset-y-16" />
      <span className="ai-marker-glow" />
      <span className="relative flex size-14 items-center justify-center rounded-full bg-white text-brand">
        <LogoMark className="h-[1.625rem] w-auto" />
      </span>
    </div>
  );
}
