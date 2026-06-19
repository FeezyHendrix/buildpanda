import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { SCENES, TRANSITION_DURATION } from "./scenes";
import { SceneShot } from "./components/SceneShot";
import { TitleCard } from "./components/TitleCard";
import { OutroCard } from "./components/OutroCard";
import { COLORS } from "./theme";

export const DEMO_TITLE_DURATION = 80;
export const DEMO_OUTRO_DURATION = 80;
export const DEMO_SCENE_DURATION = 116;
const DEMO_IDS = ["dashboard", "overview", "kanban", "gantt", "bim", "client"];

const demoScenes = DEMO_IDS.map((id) => {
  const base = SCENES.find((s) => s.id === id);
  if (!base) throw new Error(`demo scene not found: ${id}`);
  return { ...base, durationInFrames: DEMO_SCENE_DURATION };
});

export const DEMO_DURATION =
  DEMO_TITLE_DURATION +
  demoScenes.length * DEMO_SCENE_DURATION +
  DEMO_OUTRO_DURATION -
  (demoScenes.length + 1) * TRANSITION_DURATION;

const timing = linearTiming({ durationInFrames: TRANSITION_DURATION });

export const Demo: React.FC = () => {
  const children: ReactNode[] = [
    <TransitionSeries.Sequence key="title" durationInFrames={DEMO_TITLE_DURATION}>
      <TitleCard />
    </TransitionSeries.Sequence>,
    <TransitionSeries.Transition key="t-title" timing={timing} presentation={fade()} />,
  ];

  demoScenes.forEach((scene, i) => {
    children.push(
      <TransitionSeries.Sequence key={`s-${scene.id}`} durationInFrames={scene.durationInFrames}>
        <SceneShot scene={scene} />
      </TransitionSeries.Sequence>,
    );
    children.push(
      <TransitionSeries.Transition
        key={`t-${scene.id}`}
        timing={timing}
        presentation={i % 2 === 0 ? slide({ direction: "from-right" }) : fade()}
      />,
    );
  });

  children.push(
    <TransitionSeries.Sequence key="outro" durationInFrames={DEMO_OUTRO_DURATION}>
      <OutroCard />
    </TransitionSeries.Sequence>,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgTop }}>
      <TransitionSeries>{children}</TransitionSeries>
      <ProgressBar />
    </AbsoluteFill>
  );
};

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ height: 6, background: "rgba(11,21,36,0.06)" }}>
        <div style={{ height: "100%", width: `${p * 100}%`, background: COLORS.brand }} />
      </div>
    </AbsoluteFill>
  );
};
