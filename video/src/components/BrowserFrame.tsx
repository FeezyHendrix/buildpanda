import { Img, staticFile } from "remotion";
import { COLORS, FONT, SHOT_RATIO } from "../theme";

const TOP_BAR = 52;

export const BrowserFrame: React.FC<{
  src: string;
  url: string;
  width: number;
  imageScale: number;
}> = ({ src, url, width, imageScale }) => {
  const contentHeight = Math.round(width / SHOT_RATIO);
  const height = contentHeight + TOP_BAR;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 18,
        background: COLORS.white,
        border: `1px solid ${COLORS.line}`,
        boxShadow:
          "0 2px 4px rgba(11,21,36,0.04), 0 24px 60px rgba(11,21,36,0.18), 0 60px 120px rgba(11,21,36,0.10)",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          height: TOP_BAR,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 18px",
          borderBottom: `1px solid ${COLORS.line}`,
          background: "#FBFCFE",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <Dot color="#FF5F57" />
          <Dot color="#FEBC2E" />
          <Dot color="#28C840" />
        </div>
        <div
          style={{
            flex: 1,
            height: 30,
            borderRadius: 8,
            background: "#EEF1F7",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
            color: COLORS.muted,
            fontSize: 15,
            fontWeight: 500,
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          <LockIcon />
          <span>{url}</span>
        </div>
        <div style={{ width: 54 }} />
      </div>

      <div style={{ height: contentHeight, overflow: "hidden", background: COLORS.white }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
            transform: `scale(${imageScale})`,
            transformOrigin: "top center",
          }}
        />
      </div>
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div style={{ width: 13, height: 13, borderRadius: "50%", background: color }} />
);

const LockIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="11" width="14" height="9" rx="2" fill={COLORS.muted} />
    <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke={COLORS.muted} strokeWidth="2" fill="none" />
  </svg>
);
