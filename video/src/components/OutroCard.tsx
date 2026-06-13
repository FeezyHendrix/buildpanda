import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Background } from "./Background";
import { Wordmark } from "./Wordmark";
import { COLORS, FONT } from "../theme";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

function stagger(frame: number, start: number, len = 20) {
  return interpolate(frame, [start, start + len], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export const OutroCard: React.FC = () => {
  const frame = useCurrentFrame();

  const logo = stagger(frame, 0, 24);
  const tag = stagger(frame, 16);
  const pill = stagger(frame, 30);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, alignItems: "center", justifyContent: "center" }}>
      <Background />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div
          style={{
            opacity: logo,
            transform: `translateY(${interpolate(logo, [0, 1], [16, 0])}px) scale(${interpolate(logo, [0, 1], [0.9, 1])})`,
          }}
        >
          <Wordmark height={132} />
        </div>

        <div
          style={{
            marginTop: 34,
            opacity: tag,
            transform: `translateY(${interpolate(tag, [0, 1], [16, 0])}px)`,
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: -0.6,
            color: COLORS.textSoft,
          }}
        >
          Build with confidence.
        </div>

        <div
          style={{
            marginTop: 40,
            opacity: pill,
            transform: `scale(${interpolate(pill, [0, 1], [0.92, 1])})`,
            background: COLORS.brand,
            color: "#fff",
            fontSize: 24,
            fontWeight: 700,
            padding: "16px 34px",
            borderRadius: 999,
            boxShadow: "0 18px 40px rgba(0,77,231,0.32)",
          }}
        >
          buildpanda.io
        </div>
      </div>
    </AbsoluteFill>
  );
};
