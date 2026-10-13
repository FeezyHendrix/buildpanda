import { ImageResponse } from "next/og";
import { site } from "@/content/site";

/**
 * public/logo.png is 396x144 and was declared to social networks as 1200x630,
 * so every shared link rendered a stretched logo on a blank field. This draws
 * a real card at the right size instead. System fonts only: fetching a webfont
 * at build time would make the build depend on the network.
 */
export const alt = "BuildPanda: the construction operating system for Africa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0943B9",
          padding: "72px",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "#141414",
              fontSize: "30px",
              fontWeight: 800,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", fontSize: "30px", fontWeight: 700, letterSpacing: "-0.5px" }}>
            {site.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "38px",
              fontWeight: 600,
              color: "#F5C518",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            Construction management software
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "62px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-2px",
            }}
          >
            Run the entire build from one system.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: "28px", color: "#DCE6FF" }}>
          Estimates, site progress, inspections, materials and payments. buildpanda.io
        </div>
      </div>
    ),
    size,
  );
}
