"use client";

import Script from "next/script";

export function CalendlyWidget() {
  return (
    <>
      <div
        className="calendly-inline-widget w-full"
        data-url="https://calendly.com/buildpanda-io/30min?text_color=111111&primary_color=004de7"
        style={{ minWidth: 320, height: 700 }}
      />
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
      />
    </>
  );
}
