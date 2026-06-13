import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { SCENES, TITLE_DURATION, OUTRO_DURATION, TRANSITION_DURATION } from "./scenes";
import { SceneShot } from "./components/SceneShot";
import { TitleCard } from "./components/TitleCard";
import { OutroCard } from "./components/OutroCard";
import { COLORS } from "./theme";

const timing = linearTiming({ durationInFrames: TRANSITION_DURATION });

export const Walkthrough: React.FC = () => {
  const children: ReactNode[] = [
    <TransitionSeries.Sequence key="title" durationInFrames={TITLE_DURATION}>
      <TitleCard />
    </TransitionSeries.Sequence>,
    <TransitionSeries.Transition key="t-title" timing={timing} presentation={fade()} />,
  ];

  SCENES.forEach((scene, i) => {
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
    <TransitionSeries.Sequence key="outro" durationInFrames={OUTRO_DURATION}>
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
