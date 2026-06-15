import { Composition } from "remotion";
import { Walkthrough } from "./Walkthrough";
import { Demo, DEMO_DURATION } from "./Demo";
import { Announcement } from "./Announcement";
import { ANNOUNCEMENT_TOTAL_FRAMES } from "./announcement-timing.generated";
import { SCENES, TITLE_DURATION, OUTRO_DURATION, TRANSITION_DURATION } from "./scenes";
import { FPS, WIDTH, HEIGHT, UHD_WIDTH, UHD_HEIGHT } from "./theme";

const sceneTotal = SCENES.reduce((acc, s) => acc + s.durationInFrames, 0);
const transitionCount = SCENES.length + 1;
const durationInFrames =
  TITLE_DURATION + sceneTotal + OUTRO_DURATION - transitionCount * TRANSITION_DURATION;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Announcement"
        component={Announcement}
        durationInFrames={ANNOUNCEMENT_TOTAL_FRAMES}
        fps={FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
      />
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
