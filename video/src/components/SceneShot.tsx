import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Background } from "./Background";
import { BrowserFrame } from "./BrowserFrame";
import { Wordmark } from "./Wordmark";
import { Cursor, type Point } from "./Cursor";
import { COLORS, FONT, SHOT_RATIO } from "../theme";
import { TRANSITION_DURATION } from "../scenes";
import type { Scene } from "../scenes";

const FRAME_WIDTH = 1180;
const FRAME_TOP = 96;
const TOP_BAR = 52;
const CONTENT_LEFT = (1920 - FRAME_WIDTH) / 2;
const CONTENT_TOP = FRAME_TOP + TOP_BAR;
const CONTENT_H = Math.round(FRAME_WIDTH / SHOT_RATIO);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

function toScenePoint(p: Point): Point {
  return { x: CONTENT_LEFT + p.x * FRAME_WIDTH, y: CONTENT_TOP + p.y * CONTENT_H };
}

export const SceneShot: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 18], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const frameScale = interpolate(enter, [0, 1], [0.985, 1]);
  const frameY = interpolate(enter, [0, 1], [26, 0]);

  const imageScale = interpolate(frame, [0, scene.durationInFrames], [1.005, 1.03], {
    extrapolateRight: "clamp",
  });

  const capEnter = interpolate(frame, [7, 26], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subEnter = interpolate(frame, [13, 32], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const clickFrame = scene.durationInFrames - TRANSITION_DURATION - 8;
  const moveDur = 26;
  const moveStart = Math.max(18, clickFrame - moveDur - 6);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Background />

      <Wordmark style={{ position: "absolute", top: 54, left: 76 }} />

      <div
        style={{
          position: "absolute",
          left: CONTENT_LEFT,
          top: FRAME_TOP,
          opacity: enter,
          transform: `translateY(${frameY}px) scale(${frameScale})`,
        }}
      >
        <BrowserFrame src={scene.src} url={scene.url} width={FRAME_WIDTH} imageScale={imageScale} />
      </div>

      {scene.click ? (
        <Cursor
          from={toScenePoint(scene.from ?? { x: 0.5, y: 0.82 })}
          to={toScenePoint(scene.click)}
          moveStart={moveStart}
          moveDur={moveDur}
          clickFrame={clickFrame}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 912,
          textAlign: "center",
          padding: "0 120px",
        }}
      >
        <div
          style={{
            opacity: capEnter,
            transform: `translateY(${interpolate(capEnter, [0, 1], [16, 0])}px)`,
            fontSize: 46,
            fontWeight: 800,
            letterSpacing: -0.8,
            color: COLORS.text,
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 12,
            opacity: subEnter * 0.92,
            transform: `translateY(${interpolate(subEnter, [0, 1], [14, 0])}px)`,
            fontSize: 25,
            fontWeight: 500,
            color: COLORS.textSoft,
          }}
        >
          {scene.subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
