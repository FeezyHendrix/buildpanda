import Image from "next/image";

/**
 * The product on the three screens it is actually used on: a laptop in the
 * office, a tablet on site, a phone in a pocket. Every frame is CSS, so only
 * the screens ship as bitmaps and the bezels stay sharp at any width. The
 * screenshots are the same project rendered at each viewport, not one image
 * squeezed into three shapes.
 */
export function DeviceCluster({ tone = "light" }: { tone?: "light" | "dark" }) {
  // On the dark hero an ink bezel disappears into the ground, so the frames
  // switch to a light edge and the screens read as floating.
  const bezel = tone === "dark" ? "border-white/15 bg-white/10" : "border-ink/15 bg-ink/90";
  const lip = tone === "dark" ? "bg-white/10" : "bg-ink/90";
  return (
    <div className="relative mx-auto w-full max-w-5xl 2xl:max-w-6xl">
      {/* Laptop, furthest back and widest. */}
      <div className="mx-auto w-[86%]">
        <div className={`rounded-t-xl border border-b-0 ${bezel} p-1.5 shadow-[0_40px_90px_-40px_rgba(13,19,33,0.5)] sm:rounded-t-2xl sm:p-2.5`}>
          <div className="overflow-hidden rounded bg-white sm:rounded-lg">
            <Image
              src="/product/laptop-app.jpg"
              alt="A road project open in BuildPanda on a laptop: progress, schedule, budget used, cost variance and cash, with the cash-flow curve and what needs attention"
              width={2410}
              height={1506}
              priority
              sizes="(max-width: 1024px) 86vw, 900px"
              className="block w-full"
            />
          </div>
        </div>
        <div className={`relative left-1/2 h-2.5 w-[107%] -translate-x-1/2 rounded-b-lg ${lip} sm:h-4 sm:rounded-b-xl`}>
          <span className="absolute left-1/2 top-0 h-1 w-20 -translate-x-1/2 rounded-b-full bg-white/25" />
        </div>
      </div>

      {/* Tablet, front left. */}
      <div className="absolute -bottom-4 left-0 w-[38%] sm:-bottom-8 sm:left-[-2%] sm:w-[36%]">
        <div className={`rounded-xl border ${bezel} p-1.5 shadow-[0_30px_70px_-30px_rgba(13,19,33,0.5)] sm:rounded-2xl sm:p-2.5`}>
          <div className="overflow-hidden rounded bg-white sm:rounded-lg">
            <Image
              src="/product/tablet-plan.jpg"
              alt="A roof plan open on a tablet in the drawing review workspace, with the markup toolbar and the sheet scale detected as 1:120"
              width={2056}
              height={1542}
              sizes="(max-width: 1024px) 38vw, 380px"
              className="block w-full"
            />
          </div>
        </div>
      </div>

      {/* Phone, front right. */}
      <div className="absolute -bottom-6 right-0 w-[17%] sm:-bottom-10 sm:right-[1%] sm:w-[15%]">
        <div className={`rounded-[1rem] border ${bezel} p-1 shadow-[0_30px_70px_-30px_rgba(13,19,33,0.5)] sm:rounded-[1.5rem] sm:p-1.5`}>
          <div className="overflow-hidden rounded-[0.7rem] bg-white sm:rounded-[1.1rem]">
            <Image
              src="/product/phone-app.jpg"
              alt="The same project on a phone, one figure per row"
              width={780}
              height={1546}
              sizes="(max-width: 1024px) 17vw, 170px"
              className="block w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
