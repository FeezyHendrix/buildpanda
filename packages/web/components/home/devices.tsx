import Image from "next/image";

/**
 * Two screens, not three: a laptop with a drawing open on it and a tablet
 * carrying the project overview. Both frames are CSS, so only the screens ship
 * as bitmaps and the bezels stay sharp at any width. The screenshots are the
 * real app rendered at each viewport, not one image squeezed into two shapes.
 */
export function DeviceCluster({ tone = "light" }: { tone?: "light" | "dark" }) {
  // On the blue hero an ink bezel disappears into the ground, so the frames
  // switch to a light edge and the screens read as floating.
  const bezel = tone === "dark" ? "border-white/20 bg-white/10" : "border-ink/15 bg-ink/90";
  const lip = tone === "dark" ? "bg-white/10" : "bg-ink/90";

  return (
    <div className="relative mx-auto w-full max-w-6xl 2xl:max-w-7xl">
      {/* Laptop, furthest back and widest. A thin bezel: the frame is there to
          say "this is a screen", not to take up room. */}
      <div className="mx-auto w-[94%]">
        <div
          className={`rounded-t-lg border border-b-0 ${bezel} p-1 shadow-[0_40px_90px_-40px_rgba(4,20,60,0.55)] sm:rounded-t-xl sm:p-1.5`}
        >
          <div className="overflow-hidden rounded-sm bg-white sm:rounded">
            <Image
              src="/product/laptop-plan.jpg"
              alt="A roof plan open in BuildPanda's drawing review workspace on a laptop, with the markup toolbar and the sheet scale detected as 1:120"
              width={2468}
              height={1542}
              priority
              sizes="(max-width: 1024px) 94vw, 1050px"
              className="block w-full"
            />
          </div>
        </div>
        <div
          className={`relative left-1/2 h-2 w-[106%] -translate-x-1/2 rounded-b-md ${lip} sm:h-3 sm:rounded-b-lg`}
        >
          <span className="absolute left-1/2 top-0 h-0.5 w-20 -translate-x-1/2 rounded-b-full bg-white/25" />
        </div>
      </div>

      {/* Tablet, front right. */}
      <div className="absolute -bottom-7 right-0 w-[46%] sm:-bottom-12 sm:right-[-3%] sm:w-[44%]">
        <div
          className={`rounded-lg border ${bezel} p-1 shadow-[0_30px_70px_-30px_rgba(4,20,60,0.55)] sm:rounded-xl sm:p-1.5`}
        >
          <div className="overflow-hidden rounded-sm bg-white sm:rounded-md">
            <Image
              src="/product/tablet-app.jpg"
              alt="The same project's overview on a tablet: progress, schedule, budget used, cost variance and cash, with what needs attention beside them"
              width={2008}
              height={1506}
              sizes="(max-width: 1024px) 46vw, 500px"
              className="block w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
