import { Composition } from "remotion";
import { Walkthrough } from "./Walkthrough";
import { Demo, DEMO_DURATION } from "./Demo";
import { SCENES, TITLE_DURATION, OUTRO_DURATION, TRANSITION_DURATION } from "./scenes";
import { FPS, WIDTH, HEIGHT } from "./theme";

const sceneTotal = SCENES.reduce((acc, s) => acc + s.durationInFrames, 0);
const transitionCount = SCENES.length + 1;
const durationInFrames =
  TITLE_DURATION + sceneTotal + OUTRO_DURATION - transitionCount * TRANSITION_DURATION;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Walkthrough"
        component={Walkthrough}
        durationInFrames={durationInFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Demo"
        component={Demo}
        durationInFrames={DEMO_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
