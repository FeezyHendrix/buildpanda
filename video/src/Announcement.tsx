import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Easing,
} from "remotion";
import { COLORS, FONT } from "./theme";
import { Background } from "./components/Background";
import { Wordmark, Logo } from "./components/Wordmark";
import { ANNOUNCEMENT_SCENES } from "./announcement-data";
import { ANNOUNCEMENT_TIMING } from "./announcement-timing.generated";

const S = 2;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const SHOTS: Record<string, string> = {
  workspace: "shots/new-02-overview.png",
  schedule: "shots/new-05-gantt.png",
  assign: "shots/new-04-kanban.png",
  rfibim: "shots/new-07-bim.png",
  messaging: "shots/new-03-messages.png",
  portal: "shots/new-01-dashboard.png",
};

const SHOT_W = 1920;
const SHOT_H = 1080;

const BrowserShot: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.02, 1.09], { extrapolateRight: "clamp" });
  const TOP = 64;
  const width = 2560;
  const contentH = Math.round((width / SHOT_W) * SHOT_H);
  return (
    <div
      style={{
        width,
        height: contentH + TOP,
        borderRadius: 28,
        background: COLORS.white,
        border: `1px solid ${COLORS.line}`,
        boxShadow: "0 40px 120px rgba(11,21,36,0.22), 0 8px 24px rgba(11,21,36,0.10)",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          height: TOP,
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "0 28px",
          borderBottom: `1px solid ${COLORS.line}`,
          background: "#FBFCFE",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ width: 18, height: 18, borderRadius: 999, background: "#FF5F57" }} />
          <span style={{ width: 18, height: 18, borderRadius: 999, background: "#FEBC2E" }} />
          <span style={{ width: 18, height: 18, borderRadius: 999, background: "#28C840" }} />
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 760,
            margin: "0 auto",
            height: 40,
            borderRadius: 12,
            background: "#EEF1F7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: COLORS.muted,
            fontSize: 22,
            fontWeight: 500,
          }}
        >
          app.buildpanda.io
        </div>
        <div style={{ width: 80 }} />
      </div>
      <div style={{ height: contentH, overflow: "hidden" }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
            transform: `scale(${scale})`,
            transformOrigin: "top center",
          }}
        />
      </div>
    </div>
  );
};

const Caption: React.FC<{ kicker: string; title: string; accent?: string }> = ({ kicker, title, accent }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [6, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const b = interpolate(frame, [14, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <div style={{ position: "absolute", left: 130 * S, top: 90 * S, maxWidth: 1400 * S, zIndex: 2 }}>
      <div
        style={{
          opacity: a,
          transform: `translateY(${(1 - a) * 30}px)`,
          display: "inline-flex",
          alignItems: "center",
          gap: 14 * S,
          padding: `${10 * S}px ${22 * S}px`,
          borderRadius: 999,
          background: accent ?? COLORS.brand,
          color: COLORS.white,
          fontSize: 24 * S,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 12 * S, height: 12 * S, borderRadius: 999, background: COLORS.white }} />
        {kicker}
      </div>
      <div
        style={{
          opacity: b,
          transform: `translateY(${(1 - b) * 30}px)`,
          marginTop: 22 * S,
          fontSize: 70 * S,
          lineHeight: 1.05,
          fontWeight: 800,
          color: COLORS.text,
          letterSpacing: -1 * S,
          textShadow: "0 4px 40px rgba(255,255,255,0.95)",
        }}
      >
        {title}
      </div>
    </div>
  );
};

const FeatureScene: React.FC<{ shot: string; kicker: string; title: string; accent?: string }> = ({
  shot,
  kicker,
  title,
  accent,
}) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 200, mass: 0.7 } });
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Background />
      <Caption kicker={kicker} title={title} accent={accent} />
      <div
        style={{
          position: "absolute",
          right: -160 * S,
          top: 360 * S,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 70}px) scale(${0.97 + enter * 0.03})`,
        }}
      >
        <BrowserShot src={shot} />
      </div>
    </AbsoluteFill>
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoSp = spring({ frame, fps, config: { damping: 200 } });
  const l1 = interpolate(frame, [35, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const l2 = interpolate(frame, [60, 85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: `linear-gradient(160deg, ${COLORS.bgTop}, ${COLORS.bgBottom})` }}>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 * S }}>
        <div style={{ transform: `scale(${0.82 + logoSp * 0.18})`, opacity: logoSp }}>
          <Wordmark height={120 * S} />
        </div>
        <div
          style={{
            opacity: l1,
            transform: `translateY(${(1 - l1) * 30}px)`,
            fontSize: 52 * S,
            fontWeight: 700,
            color: COLORS.text,
            textAlign: "center",
            maxWidth: 1500 * S,
            lineHeight: 1.15,
          }}
        >
          One platform. Every part of your build.
        </div>
        <div style={{ opacity: l2, transform: `translateY(${(1 - l2) * 20}px)`, fontSize: 40 * S, fontWeight: 700, color: COLORS.brand }}>
          In real time.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame, fps, config: { damping: 200 } });
  const line = interpolate(frame, [35, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const underline = interpolate(frame, [55, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill
      style={{ fontFamily: FONT, background: COLORS.white, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 * S }}
    >
      <div style={{ opacity: sp, transform: `scale(${0.86 + sp * 0.14})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 * S }}>
        <Logo size={140 * S} />
        <Wordmark height={84 * S} />
      </div>
      <div style={{ width: 360 * S, height: 8 * S, background: COLORS.line, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${underline * 100}%`, background: COLORS.brand }} />
      </div>
      <div style={{ opacity: line, transform: `translateY(${(1 - line) * 20}px)`, fontSize: 46 * S, fontWeight: 700, color: COLORS.text }}>
        Build with confidence.
      </div>
      <div style={{ opacity: line, fontSize: 32 * S, fontWeight: 600, color: COLORS.muted }}>buildpanda.io</div>
    </AbsoluteFill>
  );
};

export const Announcement: React.FC = () => {
  let cursor = 0;
  const blocks: { from: number; dur: number; node: React.ReactNode }[] = [];
  const push = (key: string, node: React.ReactNode) => {
    const dur = ANNOUNCEMENT_TIMING[key] ?? 120;
    blocks.push({ from: cursor, dur, node });
    cursor += dur;
  };

  push("intro", <Intro />);
  for (const scene of ANNOUNCEMENT_SCENES) {
    push(
      scene.id,
      <FeatureScene
        shot={SHOTS[scene.id] ?? "shots/new-01-dashboard.png"}
        kicker={scene.kicker}
        title={scene.title}
        accent={scene.accent}
      />,
    );
  }
  push("outro", <Outro />);

  return (
    <AbsoluteFill style={{ background: COLORS.white }}>
      <Audio src={staticFile("audio/announcement-mix.wav")} />
      {blocks.map((b, i) => (
        <Sequence key={i} from={b.from} durationInFrames={b.dur} premountFor={30}>
          {b.node}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
