import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Background } from "./Background";
import { Wordmark } from "./Wordmark";
import { COLORS, FONT } from "../theme";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const POP = Easing.bezier(0.34, 1.4, 0.64, 1);

function stagger(frame: number, start: number, len = 20, easing = EASE_OUT) {
  return interpolate(frame, [start, start + len], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();

  const logo = stagger(frame, 0, 24, POP);
  const eyebrow = stagger(frame, 12);
  const head = stagger(frame, 18);
  const sub = stagger(frame, 32);

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Background />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ opacity: logo, transform: `scale(${interpolate(logo, [0, 1], [0.6, 1])})` }}>
          <Wordmark height={120} />
        </div>

        <div
          style={{
            marginTop: 40,
            opacity: eyebrow,
            transform: `translateY(${interpolate(eyebrow, [0, 1], [12, 0])}px)`,
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: 6,
            color: COLORS.brand,
          }}
        >
          FOR MODERN BUILDERS
        </div>

        <div
          style={{
            marginTop: 18,
            opacity: head,
            transform: `translateY(${interpolate(head, [0, 1], [20, 0])}px)`,
            fontSize: 78,
            lineHeight: 1.04,
            fontWeight: 800,
            letterSpacing: -1.8,
            color: COLORS.text,
          }}
        >
          From first enquiry
          <br />
          to a <span style={{ color: COLORS.brand }}>signed build.</span>
        </div>

        <div
          style={{
            marginTop: 28,
            opacity: sub * 0.92,
            transform: `translateY(${interpolate(sub, [0, 1], [16, 0])}px)`,
            fontSize: 27,
            fontWeight: 500,
            color: COLORS.textSoft,
          }}
        >
          One platform for sales and delivery, from enquiry to handover.
        </div>
      </div>
    </AbsoluteFill>
  );
};
