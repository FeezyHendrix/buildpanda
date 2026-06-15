import {
  AbsoluteFill,
  Audio,
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

function useIn(delay: number, dur = 24) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const sp = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.6 } });
  return { opacity: o, y: (1 - sp) * 40 };
}

const Kicker: React.FC<{ children: React.ReactNode; accent?: string }> = ({ children, accent }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 14 * S,
      padding: `${10 * S}px ${22 * S}px`,
      borderRadius: 999,
      background: accent ?? COLORS.brandSoft,
      color: accent ? COLORS.white : COLORS.brand,
      fontSize: 26 * S,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    }}
  >
    <span style={{ width: 12 * S, height: 12 * S, borderRadius: 999, background: accent ? COLORS.white : COLORS.brand }} />
    {children}
  </div>
);

const SceneText: React.FC<{ kicker: string; title: string; subtitle: string; accent?: string }> = ({
  kicker,
  title,
  subtitle,
  accent,
}) => {
  const a = useIn(6);
  const b = useIn(16);
  const c = useIn(28);
  return (
    <div style={{ maxWidth: 1500 * S, display: "flex", flexDirection: "column", gap: 28 * S }}>
      <div style={{ opacity: a.opacity, transform: `translateY(${a.y}px)` }}>
        <Kicker accent={accent}>{kicker}</Kicker>
      </div>
      <div
        style={{
          opacity: b.opacity,
          transform: `translateY(${b.y}px)`,
          fontSize: 96 * S,
          lineHeight: 1.04,
          fontWeight: 800,
          color: COLORS.text,
          letterSpacing: -1 * S,
        }}
      >
        {title}
      </div>
      <div
        style={{
          opacity: c.opacity,
          transform: `translateY(${c.y}px)`,
          fontSize: 40 * S,
          lineHeight: 1.35,
          fontWeight: 500,
          color: COLORS.textSoft,
          maxWidth: 1100 * S,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

const Panel: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 20 }) => {
  const { opacity, y } = useIn(delay, 30);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        background: COLORS.white,
        borderRadius: 28 * S,
        border: `1px solid ${COLORS.line}`,
        boxShadow: "0 30px 90px rgba(11,21,36,0.16)",
        padding: 40 * S,
        width: 900 * S,
      }}
    >
      {children}
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode; tone?: "blue" | "gray"; delay: number }> = ({
  children,
  tone = "gray",
  delay,
}) => {
  const { opacity, y } = useIn(delay, 18);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: "inline-flex",
        alignItems: "center",
        gap: 12 * S,
        padding: `${12 * S}px ${20 * S}px`,
        borderRadius: 16 * S,
        fontSize: 28 * S,
        fontWeight: 600,
        background: tone === "blue" ? COLORS.brandSoft : "#F4F6FA",
        color: tone === "blue" ? COLORS.brand : COLORS.textSoft,
        border: `1px solid ${COLORS.line}`,
      }}
    >
      {children}
    </div>
  );
};

const Avatar: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div
    style={{
      width: 56 * S,
      height: 56 * S,
      borderRadius: 999,
      background: color,
      color: COLORS.white,
      fontSize: 24 * S,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {label}
  </div>
);

const SceneShell: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <Background />
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        gap: 80 * S,
        padding: `0 ${140 * S}px`,
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  </AbsoluteFill>
);

const WorkspaceVisual: React.FC = () => (
  <Panel>
    <div style={{ display: "flex", flexDirection: "column", gap: 26 * S }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 34 * S, fontWeight: 700, color: COLORS.text }}>Project health</div>
        <Chip tone="blue" delay={28}>On Track</Chip>
      </div>
      {[
        { label: "Progress", val: 64, color: COLORS.brand },
        { label: "Budget used", val: 48, color: "#10B981" },
        { label: "Risk", val: 22, color: "#F59E0B" },
      ].map((row, i) => (
        <Row key={row.label} {...row} delay={30 + i * 8} />
      ))}
    </div>
  </Panel>
);

const Row: React.FC<{ label: string; val: number; color: string; delay: number }> = ({ label, val, color, delay }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [delay, delay + 30], [0, val], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 * S }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 * S, color: COLORS.textSoft, fontWeight: 600 }}>
        <span>{label}</span>
        <span style={{ color }}>{Math.round(w)}%</span>
      </div>
      <div style={{ height: 18 * S, borderRadius: 999, background: "#EEF1F7" }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
};

const ScheduleVisual: React.FC = () => {
  const bars = [
    { name: "Foundation", start: 0, len: 3, color: "#10B981" },
    { name: "Superstructure", start: 2, len: 5, color: COLORS.brand },
    { name: "MEP", start: 5, len: 4, color: "#8B5CF6" },
    { name: "Finishing", start: 8, len: 4, color: "#F59E0B" },
  ];
  return (
    <Panel>
      <div style={{ fontSize: 34 * S, fontWeight: 700, color: COLORS.text, marginBottom: 28 * S }}>Programme</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 * S }}>
        {bars.map((b, i) => {
          const cell = 64 * S;
          const a = useIn(30 + i * 8, 22);
          return (
            <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 20 * S, opacity: a.opacity }}>
              <div style={{ width: 240 * S, fontSize: 26 * S, color: COLORS.textSoft, fontWeight: 600 }}>{b.name}</div>
              <div style={{ position: "relative", flex: 1, height: 36 * S }}>
                <div
                  style={{
                    position: "absolute",
                    left: b.start * cell,
                    width: b.len * cell,
                    height: "100%",
                    borderRadius: 10 * S,
                    background: b.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

const AssignVisual: React.FC = () => (
  <Panel>
    <div style={{ fontSize: 34 * S, fontWeight: 700, color: COLORS.text, marginBottom: 24 * S }}>Kanban</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 20 * S }}>
      {[
        { t: "Confirm rebar spec", who: "BA", c: COLORS.brand },
        { t: "Beam clashes with duct", who: "QO", c: "#8B5CF6" },
        { t: "Slab pour — Floor 2", who: "AI", c: "#10B981" },
      ].map((card, i) => {
        const a = useIn(30 + i * 10, 20);
        return (
          <div
            key={card.t}
            style={{
              opacity: a.opacity,
              transform: `translateY(${a.y}px)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `${24 * S}px ${28 * S}px`,
              borderRadius: 18 * S,
              border: `1px solid ${COLORS.line}`,
              background: "#FBFCFE",
              fontSize: 30 * S,
              fontWeight: 600,
              color: COLORS.text,
            }}
          >
            <span>{card.t}</span>
            <Avatar label={card.who} color={card.c} />
          </div>
        );
      })}
    </div>
  </Panel>
);

const MessagingVisual: React.FC = () => {
  const msgs = [
    { who: "Bola", c: COLORS.brand, text: "Beam clash on level 3 — see the model", delay: 30 },
    { who: "Tunde", c: "#10B981", text: "On it. Promoting to RFI now.", delay: 60 },
  ];
  return (
    <Panel delay={18}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 * S, marginBottom: 24 * S }}>
        <span style={{ fontSize: 34 * S, fontWeight: 800, color: COLORS.muted }}>#</span>
        <span style={{ fontSize: 34 * S, fontWeight: 700, color: COLORS.text }}>general</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 * S }}>
        {msgs.map((m) => {
          const a = useIn(m.delay, 18);
          return (
            <div key={m.who} style={{ opacity: a.opacity, transform: `translateY(${a.y}px)`, display: "flex", gap: 18 * S }}>
              <Avatar label={m.who[0]!} color={m.c} />
              <div>
                <div style={{ fontSize: 26 * S, fontWeight: 700, color: COLORS.text }}>{m.who}</div>
                <div style={{ fontSize: 30 * S, color: COLORS.textSoft, marginTop: 4 * S }}>{m.text}</div>
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 14 * S, marginTop: 8 * S }}>
          <Chip tone="blue" delay={90}>@mention</Chip>
          <Chip tone="blue" delay={100}>RFI-014</Chip>
          <Chip delay={110}>👍 2</Chip>
          <Chip delay={120}>→ Task</Chip>
        </div>
      </div>
    </Panel>
  );
};

const RfiBimVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const rot = interpolate(frame, [0, 120], [-12, 12], { extrapolateRight: "clamp" });
  return (
    <Panel delay={18}>
      <div style={{ fontSize: 34 * S, fontWeight: 700, color: COLORS.text, marginBottom: 28 * S }}>BIM model</div>
      <div
        style={{
          height: 380 * S,
          borderRadius: 20 * S,
          background: "linear-gradient(160deg, #1a1f2b, #0d1017)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ transform: `perspective(1200px) rotateY(${rot}deg) rotateX(12deg)`, transformStyle: "preserve-3d" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 280 * S,
                height: 64 * S,
                marginBottom: 10 * S,
                background: `rgba(0,77,231,${0.35 + i * 0.2})`,
                border: "2px solid rgba(120,170,255,0.6)",
                borderRadius: 6 * S,
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            top: 90 * S,
            right: 150 * S,
            width: 28 * S,
            height: 28 * S,
            borderRadius: 999,
            background: "#F59E0B",
            border: `4px solid ${COLORS.white}`,
            boxShadow: "0 0 0 8px rgba(245,158,11,0.3)",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 14 * S, marginTop: 24 * S }}>
        <Chip tone="blue" delay={40}>Coordination issue</Chip>
        <Chip delay={50}>Promote to RFI</Chip>
      </div>
    </Panel>
  );
};

const PortalVisual: React.FC = () => (
  <Panel>
    <div style={{ fontSize: 34 * S, fontWeight: 700, color: COLORS.text, marginBottom: 24 * S }}>Client portal</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 * S }}>
      {["Overview", "Build Stages", "RFIs", "What's Next"].map((item, i) => {
        const a = useIn(30 + i * 8, 18);
        return (
          <div
            key={item}
            style={{
              opacity: a.opacity,
              transform: `translateX(${(1 - a.opacity) * 30}px)`,
              display: "flex",
              alignItems: "center",
              gap: 18 * S,
              fontSize: 30 * S,
              fontWeight: 600,
              color: COLORS.textSoft,
            }}
          >
            <span style={{ width: 14 * S, height: 14 * S, borderRadius: 999, background: COLORS.brand }} />
            {item}
          </div>
        );
      })}
    </div>
    <div style={{ marginTop: 30 * S }}>
      <Chip tone="blue" delay={70}>Scoped to one project · zero leaks</Chip>
    </div>
  </Panel>
);

const VISUALS: Record<string, React.FC> = {
  workspace: WorkspaceVisual,
  schedule: ScheduleVisual,
  assign: AssignVisual,
  rfibim: RfiBimVisual,
  messaging: MessagingVisual,
  portal: PortalVisual,
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoSp = spring({ frame, fps, config: { damping: 200 } });
  const line1 = useIn(40);
  const line2 = useIn(70);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: `linear-gradient(160deg, ${COLORS.bgTop}, ${COLORS.bgBottom})` }}>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 * S }}>
        <div style={{ transform: `scale(${0.8 + logoSp * 0.2})`, opacity: logoSp }}>
          <Wordmark height={120 * S} />
        </div>
        <div
          style={{
            opacity: line1.opacity,
            transform: `translateY(${line1.y}px)`,
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
        <div
          style={{
            opacity: line2.opacity,
            transform: `translateY(${line2.y}px)`,
            fontSize: 40 * S,
            fontWeight: 600,
            color: COLORS.brand,
          }}
        >
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
  const line = useIn(40);
  const underline = interpolate(frame, [60, 95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: COLORS.white, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 * S }}>
      <div style={{ opacity: sp, transform: `scale(${0.85 + sp * 0.15})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 * S }}>
        <Logo size={140 * S} />
        <Wordmark height={90 * S} />
      </div>
      <div style={{ width: 360 * S, height: 8 * S, background: COLORS.line, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${underline * 100}%`, background: COLORS.brand }} />
      </div>
      <div style={{ opacity: line.opacity, transform: `translateY(${line.y}px)`, fontSize: 46 * S, fontWeight: 700, color: COLORS.text }}>
        Build with confidence.
      </div>
      <div style={{ opacity: line.opacity, fontSize: 34 * S, fontWeight: 600, color: COLORS.muted }}>buildpanda.io</div>
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
    const Visual = VISUALS[scene.id];
    push(
      scene.id,
      <SceneShell right={Visual ? <Visual /> : undefined}>
        <SceneText kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} accent={scene.accent} />
      </SceneShell>,
    );
  }
  push("outro", <Outro />);

  return (
    <AbsoluteFill style={{ background: COLORS.white }}>
      <Audio src={staticFile("audio/announcement-vo.wav")} />
      {blocks.map((b, i) => (
        <Sequence key={i} from={b.from} durationInFrames={b.dur} premountFor={30}>
          {b.node}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
