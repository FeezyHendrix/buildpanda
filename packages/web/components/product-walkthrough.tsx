export function ProductWalkthrough() {
  return (
    <figure
      id="product-tour"
      className="mt-8 w-full max-w-5xl overflow-hidden rounded-xl border border-line bg-white text-left shadow-[0_24px_70px_-35px_rgba(13,19,33,0.3)]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <p className="text-sm font-semibold text-ink">See BuildPanda in action</p>
        <span className="shrink-0 text-xs tabular-nums text-muted">1 min 28 sec</span>
      </div>
      <video
        controls
        playsInline
        preload="none"
        poster="/product/walkthrough-poster.jpg"
        width={1920}
        height={1080}
        aria-label="BuildPanda product walkthrough"
        aria-describedby="product-tour-caption"
        className="block aspect-video w-full bg-surface-faint"
      >
        <source src="/buildpanda-walkthrough.mp4" type="video/mp4" />
        <track
          kind="captions"
          src="/buildpanda-walkthrough.en.vtt"
          srcLang="en"
          label="English"
        />
        <p>
          <a href="/buildpanda-walkthrough.mp4">Open the product walkthrough</a>.
        </p>
      </video>
      <figcaption id="product-tour-caption" className="px-5 py-4 text-sm leading-relaxed text-muted sm:px-6">
        Follow a project through setup, tasks, scheduling, materials and team
        collaboration. Use the player controls to pause, turn on captions or
        watch in full screen.
      </figcaption>
    </figure>
  );
}
